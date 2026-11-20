import { useMemo } from 'react';
import { formatDuration, formatTokens } from '@/lib/format';
import { buildLane, type Segment } from '../../../../server/analysis';
import { findSession, useSessionStore } from '../store/sessionStore';

const SEGMENT_TITLES: Record<Segment['kind'], string> = { waiting: 'Espera', process: 'Processo longo', tool: 'Ferramenta' };
const RESULT_LABELS = { passed: 'passou', failed: 'falhou', inconclusive: 'inconclusivo' } as const;

function SegmentCard({ segment }: { segment: Segment }) {
    return (
        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="font-semibold text-stone-900">{SEGMENT_TITLES[segment.kind]}</h3>
            <p className="font-mono text-xs break-all text-stone-700">{segment.label}</p>
            <p className="text-stone-600">
                {formatDuration(segment.end - segment.start)}
                {segment.result && ` · ${RESULT_LABELS[segment.result]}`}
                {segment.polls !== undefined && ` · ${segment.polls} consultas`}
            </p>
            {segment.kind !== 'tool' && (
                <p className="text-stone-600">
                    {segment.calls} chamadas ao modelo · {formatTokens(segment.tokens)} tokens
                </p>
            )}
        </div>
    );
}

/** Side panel for the selected agent: token breakdown and the tools it called most. */
export function SessionDetails() {
    const session = useSessionStore((state) => findSession(state.root, state.selectedId));
    const selectedSegment = useSessionStore((state) => state.selectedSegment);
    const lane = useMemo(() => (session ? buildLane(session, 0) : null), [session]);
    if (!session || !lane) {
        return <p className="p-4 text-sm text-stone-500">Selecione um agente na árvore.</p>;
    }

    const toolCounts = new Map<string, number>();
    for (const event of session.events) {
        if (event.kind === 'tool' || event.kind === 'action' || event.kind === 'spawn') {
            toolCounts.set(event.name ?? '?', (toolCounts.get(event.name ?? '?') ?? 0) + 1);
        }
    }
    const topTools = [...toolCounts].sort((a, b) => b[1] - a[1]);
    const averageContext = session.calls.length ? session.tokens.total / session.calls.length : 0;
    const rows: [string, string][] = [
        ['Entrada (sem cache)', formatTokens(session.tokens.input)],
        ['Cache lido', formatTokens(session.tokens.cacheRead)],
        ['Cache gravado', formatTokens(session.tokens.cacheWrite)],
        ['Saída', formatTokens(session.tokens.output)],
        ['Raciocínio (dentro da saída)', formatTokens(session.tokens.reasoning)],
        ['Contexto médio por chamada', formatTokens(averageContext)],
        ['Duração', formatDuration(session.durationMs)],
    ];
    const waitingRows: [string, string][] = [
        ['Tempo esperando', formatDuration(lane.stats.waitingMs)],
        ['Chamadas ao modelo esperando', String(lane.stats.waitingCalls)],
        ['Tokens gastos esperando', formatTokens(lane.stats.waitingTokens)],
    ];
    const longProcesses = lane.segments.filter((segment) => segment.kind === 'process').sort((a, b) => b.end - b.start - (a.end - a.start));

    return (
        <div className="space-y-4 p-4 text-sm">
            <div>
                <h2 className="font-semibold text-stone-900">{session.nickname ?? session.role}</h2>
                <p className="text-stone-500">
                    {session.tool} · {session.model ?? '?'} {session.effort ? `· ${session.effort}` : ''}
                </p>
            </div>
            {selectedSegment && <SegmentCard segment={selectedSegment} />}
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                {[...rows, ...waitingRows].map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-stone-500">{label}</dt>
                        <dd className="text-right font-medium tabular-nums text-stone-900">{value}</dd>
                    </div>
                ))}
            </dl>
            {longProcesses.length > 0 && (
                <div>
                    <h3 className="mb-1 font-semibold text-stone-900">Processos longos</h3>
                    <ul className="space-y-1">
                        {longProcesses.map((segment) => (
                            <li key={segment.start} className="text-stone-700">
                                <span className="tabular-nums">{formatDuration(segment.end - segment.start)}</span> · {RESULT_LABELS[segment.result ?? 'inconclusive']}
                                <span className="block truncate font-mono text-xs text-stone-500">{segment.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div>
                <h3 className="mb-1 font-semibold text-stone-900">Ferramentas</h3>
                <ul className="space-y-0.5">
                    {topTools.map(([name, count]) => (
                        <li key={name} className="flex justify-between text-stone-700">
                            <span className="truncate">{name}</span>
                            <span className="tabular-nums">{count}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
