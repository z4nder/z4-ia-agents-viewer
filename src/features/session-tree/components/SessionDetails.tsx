import { formatDuration, formatTokens } from '@/lib/format';
import { findSession, useSessionStore } from '../store/sessionStore';

/** Side panel for the selected agent: token breakdown and the tools it called most. */
export function SessionDetails() {
    const session = useSessionStore((state) => findSession(state.root, state.selectedId));
    if (!session) {
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

    return (
        <div className="space-y-4 p-4 text-sm">
            <div>
                <h2 className="font-semibold text-stone-900">{session.nickname ?? session.role}</h2>
                <p className="text-stone-500">
                    {session.tool} · {session.model ?? '?'} {session.effort ? `· ${session.effort}` : ''}
                </p>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                {rows.map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-stone-500">{label}</dt>
                        <dd className="text-right font-medium tabular-nums text-stone-900">{value}</dd>
                    </div>
                ))}
            </dl>
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
