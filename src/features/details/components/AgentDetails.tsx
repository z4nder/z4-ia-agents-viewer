import { useMemo } from 'react';
import { Row, Section } from '@/components/detail';
import { Stat } from '@/components/Stat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDuration, formatTokens } from '@/lib/format';
import { TOOL_BADGE_CLASSES, TOOL_LABELS } from '@/lib/toolColors';
import { cn } from '@/lib/utils';
import { SKILL_USE_LABELS, tagEvent, type SkillUse } from '../../../../server/classify';
import { buildLane, type ProcessResult } from '../../../../server/analysis';
import type { Session } from '../../../../server/model';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';

const RESULT_LABELS: Record<ProcessResult, string> = { passed: 'Passou', failed: 'Falhou', inconclusive: 'Inconclusivo' };
const RESULT_DOT_CLASSES: Record<ProcessResult, string> = { passed: 'bg-blue-500', failed: 'bg-red-500', inconclusive: 'bg-neutral-400' };

const TOKEN_PARTS = [
    { key: 'input', label: 'Entrada sem cache', className: 'bg-sky-500' },
    { key: 'cacheRead', label: 'Cache lido', className: 'bg-sky-300 dark:bg-sky-800' },
    { key: 'cacheWrite', label: 'Cache gravado', className: 'bg-indigo-400' },
    { key: 'output', label: 'Saída', className: 'bg-emerald-500' },
] as const;

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

interface Usage {
    name: string;
    count: number;
    details: string[];
}

/** Skills by name (with how they were used) and MCP servers (with the tools called). */
function collectUsage(session: Session): { skills: Usage[]; mcp: Usage[] } {
    const skills = new Map<string, { count: number; uses: Set<SkillUse> }>();
    const servers = new Map<string, { count: number; tools: Set<string> }>();
    for (const event of session.events) {
        const tags = tagEvent(event);
        if (tags.skill) {
            const entry = skills.get(tags.skill.name) ?? { count: 0, uses: new Set() };
            entry.count += 1;
            entry.uses.add(tags.skill.use);
            skills.set(tags.skill.name, entry);
        }
        if (tags.mcp) {
            const entry = servers.get(tags.mcp.server) ?? { count: 0, tools: new Set() };
            entry.count += 1;
            entry.tools.add(tags.mcp.tool);
            servers.set(tags.mcp.server, entry);
        }
    }
    const byCount = (a: Usage, b: Usage) => b.count - a.count;
    return {
        skills: [...skills].map(([name, entry]) => ({ name, count: entry.count, details: [...entry.uses].map((use) => SKILL_USE_LABELS[use]) })).sort(byCount),
        mcp: [...servers].map(([name, entry]) => ({ name, count: entry.count, details: [...entry.tools] })).sort(byCount),
    };
}

function UsageList({ title, items, dotClass }: { title: string; items: Usage[]; dotClass: string }) {
    if (items.length === 0) {
        return null;
    }
    return (
        <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{title}</div>
            <ul className="space-y-2">
                {items.map((item) => (
                    <li key={item.name}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className={cn('size-2 shrink-0 rounded-full', dotClass)} />
                                <span className="truncate">{item.name}</span>
                            </span>
                            <span className="font-medium tabular-nums">{item.count}</span>
                        </div>
                        <p className="truncate pl-4 text-xs text-muted-foreground">{item.details.join(', ')}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Everything about one agent: stats, tokens, waits, long processes, MCP and skills, tools. */
export function AgentDetails({ sessionId }: { sessionId: string }) {
    const session = useSessionStore((state) => findSession(state.root, sessionId));
    const view = useSessionStore((state) => state.view);
    const setView = useSessionStore((state) => state.setView);
    const lane = useMemo(() => (session ? buildLane(session, 0) : null), [session]);

    if (!session || !lane) {
        return null;
    }

    const toolCounts = new Map<string, number>();
    for (const event of session.events) {
        if (event.kind === 'tool' || event.kind === 'action' || event.kind === 'spawn') {
            toolCounts.set(event.name ?? '?', (toolCounts.get(event.name ?? '?') ?? 0) + 1);
        }
    }
    const tools = [...toolCounts].sort((a, b) => b[1] - a[1]);
    const mostUsed = tools[0]?.[1] ?? 1;
    const usage = collectUsage(session);
    const longProcesses = lane.segments.filter((segment) => segment.kind === 'process').sort((a, b) => b.end - b.start - (a.end - a.start));

    return (
        <div className="space-y-5">
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

            {(usage.skills.length > 0 || usage.mcp.length > 0) && (
                <>
                    <Separator />
                    <Section title="MCP e skills">
                        <UsageList title="Skills" items={usage.skills} dotClass="bg-fuchsia-500" />
                        <UsageList title="Servidores MCP" items={usage.mcp} dotClass="bg-sky-500" />
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
