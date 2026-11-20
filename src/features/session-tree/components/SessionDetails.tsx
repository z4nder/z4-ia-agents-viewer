import { useMemo, type ReactNode } from 'react';
import { Stat } from '@/components/Stat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDuration, formatTokens } from '@/lib/format';
import { TOOL_BADGE_CLASSES, TOOL_LABELS } from '@/lib/toolColors';
import { cn } from '@/lib/utils';
import { buildLane, type ProcessResult, type Segment } from '../../../../server/analysis';
import type { Session } from '../../../../server/model';
import { findSession, useSessionStore } from '../store/sessionStore';

const SEGMENT_TITLES: Record<Segment['kind'], string> = { waiting: 'Bloco de espera', process: 'Processo longo', tool: 'Chamada de ferramenta' };
const RESULT_LABELS: Record<ProcessResult, string> = { passed: 'Passou', failed: 'Falhou', inconclusive: 'Inconclusivo' };
const RESULT_DOT_CLASSES: Record<ProcessResult, string> = { passed: 'bg-blue-500', failed: 'bg-red-500', inconclusive: 'bg-neutral-400' };

const TOKEN_PARTS = [
    { key: 'input', label: 'Entrada sem cache', className: 'bg-sky-500' },
    { key: 'cacheRead', label: 'Cache lido', className: 'bg-sky-300 dark:bg-sky-800' },
    { key: 'cacheWrite', label: 'Cache gravado', className: 'bg-indigo-400' },
    { key: 'output', label: 'Saída', className: 'bg-emerald-500' },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="text-sm font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Row({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
                {swatch && <span className={cn('size-2 rounded-full', swatch)} />}
                {label}
            </span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );
}

function SelectedSegment({ segment }: { segment: Segment }) {
    return (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{SEGMENT_TITLES[segment.kind]}</span>
                {segment.result && <Badge variant="outline">{RESULT_LABELS[segment.result]}</Badge>}
            </div>
            <p className="font-mono text-xs break-all text-muted-foreground">{segment.label}</p>
            <div className="grid grid-cols-3 gap-2">
                <Stat value={formatDuration(segment.end - segment.start)} label="duração" />
                {segment.kind !== 'tool' && <Stat value={String(segment.calls)} label="chamadas" />}
                {segment.kind !== 'tool' && <Stat value={formatTokens(segment.tokens)} label="tokens" />}
            </div>
        </div>
    );
}

function TokenBreakdown({ session }: { session: Session }) {
    const total = session.tokens.total || 1;
    return (
        <Section title="Tokens">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {TOKEN_PARTS.map((part) => (
                    <div key={part.key} className={part.className} style={{ width: `${(session.tokens[part.key] / total) * 100}%` }} />
                ))}
            </div>
            <div className="space-y-1.5">
                {TOKEN_PARTS.map((part) => (
                    <Row key={part.key} label={part.label} value={formatTokens(session.tokens[part.key])} swatch={part.className} />
                ))}
                <Row label="Raciocínio, dentro da saída" value={formatTokens(session.tokens.reasoning)} />
                <Row label="Contexto médio por chamada" value={formatTokens(session.calls.length ? session.tokens.total / session.calls.length : 0)} />
            </div>
        </Section>
    );
}

/** Side panel for the selected agent. */
export function SessionDetails() {
    const session = useSessionStore((state) => findSession(state.root, state.selectedId));
    const selectedSegment = useSessionStore((state) => state.selectedSegment);
    const view = useSessionStore((state) => state.view);
    const setView = useSessionStore((state) => state.setView);
    const lane = useMemo(() => (session ? buildLane(session, 0) : null), [session]);

    if (!session || !lane) {
        return <p className="p-4 text-sm text-muted-foreground">Clique num agente para ver os detalhes.</p>;
    }

    const toolCounts = new Map<string, number>();
    for (const event of session.events) {
        if (event.kind === 'tool' || event.kind === 'action' || event.kind === 'spawn') {
            toolCounts.set(event.name ?? '?', (toolCounts.get(event.name ?? '?') ?? 0) + 1);
        }
    }
    const tools = [...toolCounts].sort((a, b) => b[1] - a[1]);
    const mostUsed = tools[0]?.[1] ?? 1;
    const longProcesses = lane.segments.filter((segment) => segment.kind === 'process').sort((a, b) => b.end - b.start - (a.end - a.start));

    return (
        <div className="space-y-5 p-4">
            <header className="space-y-2">
                <h2 className="text-base leading-snug font-semibold">{session.nickname ?? session.role}</h2>
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className={cn('border-0', TOOL_BADGE_CLASSES[session.tool])}>
                        {TOOL_LABELS[session.tool]}
                    </Badge>
                    {session.nickname && <Badge variant="outline">{session.role}</Badge>}
                    {session.model && <Badge variant="outline">{session.model}</Badge>}
                    {session.effort && <Badge variant="outline">{session.effort}</Badge>}
                </div>
            </header>

            <div className="grid grid-cols-3 gap-3">
                <Stat value={formatTokens(session.tokens.total)} label="tokens" />
                <Stat value={String(session.calls.length)} label="chamadas" />
                <Stat value={formatDuration(session.durationMs)} label="duração" />
            </div>

            {view !== 'activity' && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setView('activity')}>
                    Ver o que este agente fez
                </Button>
            )}

            {selectedSegment && <SelectedSegment segment={selectedSegment} />}

            <Separator />
            <TokenBreakdown session={session} />

            {lane.stats.waitingMs > 0 && (
                <>
                    <Separator />
                    <Section title="Espera">
                        <div className="space-y-1.5">
                            <Row label="Tempo esperando" value={formatDuration(lane.stats.waitingMs)} swatch="bg-amber-500" />
                            <Row label="Chamadas ao modelo" value={String(lane.stats.waitingCalls)} />
                            <Row label="Tokens gastos" value={formatTokens(lane.stats.waitingTokens)} />
                        </div>
                    </Section>
                </>
            )}

            {longProcesses.length > 0 && (
                <>
                    <Separator />
                    <Section title="Processos longos">
                        <ul className="space-y-2.5">
                            {longProcesses.map((segment) => (
                                <li key={segment.start} className="space-y-0.5">
                                    <div className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-2">
                                            <span className={cn('size-2 rounded-full', RESULT_DOT_CLASSES[segment.result ?? 'inconclusive'])} />
                                            {RESULT_LABELS[segment.result ?? 'inconclusive']}
                                        </span>
                                        <span className="font-medium tabular-nums">{formatDuration(segment.end - segment.start)}</span>
                                    </div>
                                    <p className="truncate font-mono text-xs text-muted-foreground" title={segment.label}>
                                        {segment.label}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </Section>
                </>
            )}

            <Separator />
            <Section title="Ferramentas">
                <ul className="space-y-2">
                    {tools.map(([name, count]) => (
                        <li key={name} className="space-y-1">
                            <div className="flex justify-between gap-2 text-sm">
                                <span className="truncate">{name}</span>
                                <span className="font-medium tabular-nums">{count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted">
                                <div className="h-1 rounded-full bg-foreground/40" style={{ width: `${(count / mostUsed) * 100}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            </Section>
        </div>
    );
}
