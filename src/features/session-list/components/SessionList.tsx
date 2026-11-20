import { useEffect, useMemo } from 'react';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { filterSessions, projectOf, useSessionListStore, type SessionFilters } from '../store/sessionListStore';

const SOURCE_LABELS: Record<SessionFilters['source'], string> = {
    all: 'Todas',
    claude: 'Claude',
    codex: 'Codex pessoal',
    'codex-empresa': 'Codex empresa',
    gravada: 'Gravadas',
};

const SOURCE_COLORS: Record<string, string> = {
    claude: 'bg-orange-100 text-orange-800',
    codex: 'bg-teal-100 text-teal-800',
    'codex-empresa': 'bg-teal-100 text-teal-800',
    gravada: 'bg-stone-200 text-stone-700',
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Sessions found on disk, filtered by tool, project and date; clicking one opens its tree. */
export function SessionList() {
    const sessions = useSessionListStore((state) => state.sessions);
    const filters = useSessionListStore((state) => state.filters);
    const isLoading = useSessionListStore((state) => state.isLoading);
    const refresh = useSessionListStore((state) => state.refresh);
    const setFilters = useSessionListStore((state) => state.setFilters);
    const openFile = useSessionStore((state) => state.load);
    const openedFile = useSessionStore((state) => state.root?.file);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const projects = useMemo(() => [...new Set(sessions.map(projectOf))].sort(), [sessions]);
    const visible = useMemo(() => filterSessions(sessions, filters), [sessions, filters]);
    const inputClass = 'w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-xs';

    return (
        <div className="flex h-full flex-col">
            <div className="space-y-2 border-b border-stone-200 p-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Sessões</h2>
                    <button className="text-xs text-stone-500 hover:text-stone-900" onClick={() => void refresh()}>
                        {isLoading ? 'Atualizando…' : 'Atualizar'}
                    </button>
                </div>
                <select className={inputClass} value={filters.source} onChange={(event) => setFilters({ source: event.target.value as SessionFilters['source'] })}>
                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <select className={inputClass} value={filters.project} onChange={(event) => setFilters({ project: event.target.value })}>
                    <option value="">Todos os projetos</option>
                    {projects.map((project) => (
                        <option key={project} value={project}>
                            {project}
                        </option>
                    ))}
                </select>
                <div className="flex gap-2">
                    <input type="date" className={inputClass} value={filters.from} onChange={(event) => setFilters({ from: event.target.value })} aria-label="De" />
                    <input type="date" className={inputClass} value={filters.to} onChange={(event) => setFilters({ to: event.target.value })} aria-label="Até" />
                </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
                {visible.map((session) => (
                    <li key={session.file}>
                        <button
                            className={`block w-full border-b border-stone-100 px-3 py-2 text-left hover:bg-stone-50 ${session.file === openedFile ? 'bg-stone-100' : ''}`}
                            onClick={() => void openFile(session.file)}
                        >
                            <span className="line-clamp-2 text-sm text-stone-900">{session.title ?? 'sem título'}</span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                                <span className={`rounded px-1.5 py-0.5 ${SOURCE_COLORS[session.source]}`}>{SOURCE_LABELS[session.source]}</span>
                                <span className="truncate">{projectOf(session)}</span>
                                <span className="ml-auto shrink-0 tabular-nums">{dateFormat.format(new Date(session.updatedAt))}</span>
                            </span>
                        </button>
                    </li>
                ))}
                {visible.length === 0 && !isLoading && <li className="p-3 text-xs text-stone-500">Nenhuma sessão com esses filtros.</li>}
            </ul>
        </div>
    );
}
