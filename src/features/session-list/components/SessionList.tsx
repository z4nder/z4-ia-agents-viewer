import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { SOURCE_BADGE_CLASSES, SOURCE_LABELS } from '@/lib/toolColors';
import { cn } from '@/lib/utils';
import { filterSessions, projectOf, useSessionListStore, type SessionFilters } from '../store/sessionListStore';

const ALL_PROJECTS = '__all__';

const FILTER_LABELS: Record<SessionFilters['source'], string> = {
    all: 'Todas as ferramentas',
    claude: 'Claude',
    codex: 'Codex pessoal',
    'codex-empresa': 'Codex empresa',
    gravada: 'Gravadas',
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

    return (
        <div className="flex h-full flex-col">
            <div className="space-y-2 border-b p-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                        Sessões <span className="font-normal text-muted-foreground">{visible.length}</span>
                    </h2>
                    <Button variant="ghost" size="icon-sm" aria-label="Atualizar" onClick={() => void refresh()}>
                        <RefreshCw className={cn(isLoading && 'animate-spin')} />
                    </Button>
                </div>
                <Select value={filters.source} onValueChange={(value) => setFilters({ source: value as SessionFilters['source'] })}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(FILTER_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filters.project || ALL_PROJECTS} onValueChange={(value) => setFilters({ project: value === ALL_PROJECTS ? '' : value })}>
                    <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_PROJECTS}>Todos os projetos</SelectItem>
                        {projects.map((project) => (
                            <SelectItem key={project} value={project}>
                                {project}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Input type="date" className="h-8 text-xs" value={filters.from} onChange={(event) => setFilters({ from: event.target.value })} aria-label="De" />
                    <Input type="date" className="h-8 text-xs" value={filters.to} onChange={(event) => setFilters({ to: event.target.value })} aria-label="Até" />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ul>
                    {visible.map((session) => (
                        <li key={session.file}>
                            <button
                                className={cn('block w-full border-b px-3 py-2 text-left transition-colors hover:bg-accent', session.file === openedFile && 'bg-accent')}
                                onClick={() => void openFile(session.file)}
                            >
                                <span className="line-clamp-2 text-sm">{session.title ?? <span className="text-muted-foreground italic">sem título</span>}</span>
                                <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className={cn('border-0', SOURCE_BADGE_CLASSES[session.source])}>
                                        {SOURCE_LABELS[session.source]}
                                    </Badge>
                                    <span className="truncate">{projectOf(session)}</span>
                                    <span className="ml-auto shrink-0 tabular-nums">{dateFormat.format(new Date(session.updatedAt))}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                    {visible.length === 0 && !isLoading && <li className="p-3 text-xs text-muted-foreground">Nenhuma sessão com esses filtros.</li>}
                </ul>
            </div>
        </div>
    );
}
