import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { cn } from '@/lib/utils';
import { activeFilterCount, filterSessions, projectOf, sortSessions, type SessionSort } from '../sessionFilters';
import { useSessionListStore } from '../store/sessionListStore';
import { SessionCard } from './SessionCard';
import { SessionFiltersPanel } from './SessionFiltersPanel';
import { ActiveSessionFilters } from './ActiveSessionFilters';

const SORT_LABELS: Record<SessionSort, string> = {
    updatedAt: 'Última atualização', title: 'Nome da sessão', agentCount: 'Quantidade de agentes',
    callCount: 'Chamadas ao modelo', totalTokens: 'Tokens totais', durationMs: 'Duração total', models: 'Modelo usado',
};

export function SessionList() {
    const { sessions, filters, sort, direction, isLoading, error, refresh, setFilters, resetFilters, setSort, toggleDirection } = useSessionListStore();
    const openFile = useSessionStore((state) => state.load);
    const openedFile = useSessionStore((state) => state.root?.file);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterCount = activeFilterCount(filters);

    useEffect(() => { void refresh(); }, [refresh]);

    const projects = useMemo(() => [...new Set(sessions.map(projectOf))].sort(), [sessions]);
    const models = useMemo(() => [...new Set(sessions.flatMap((session) => session.models))].sort(), [sessions]);
    const visible = useMemo(() => sortSessions(filterSessions(sessions, filters), sort, direction), [sessions, filters, sort, direction]);

    return (
        <div className="flex flex-col">
            <div className="sticky top-0 z-10 space-y-2.5 border-b bg-sidebar p-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                    <Input type="search" placeholder="Buscar pelo nome da sessão…" aria-label="Buscar pelo nome da sessão" className="h-9 pr-8 pl-8 text-xs [&::-webkit-search-cancel-button]:appearance-none"
                        value={filters.query} onChange={(event) => setFilters({ query: event.target.value })} />
                    {filters.query && <Button variant="ghost" size="icon-sm" className="absolute top-1 right-0.5" aria-label="Limpar busca" onClick={() => setFilters({ query: '' })}><X /></Button>}
                </div>
                <div className="flex items-center gap-1.5">
                    <Select value={sort} onValueChange={(value) => setSort(value as SessionSort)}>
                        <SelectTrigger className="min-w-0 flex-1 text-xs" aria-label="Ordenar sessões por"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(SORT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" size="icon-sm" className="size-8 shrink-0" onClick={toggleDirection}
                        aria-label={direction === 'desc' ? 'Ordem decrescente; mudar para crescente' : 'Ordem crescente; mudar para decrescente'}
                        title={direction === 'desc' ? 'Maior para menor / mais recente primeiro' : 'Menor para maior / mais antiga primeiro'}>
                        {direction === 'desc' ? <ArrowDownWideNarrow /> : <ArrowUpNarrowWide />}
                    </Button>
                    <Button variant={filtersOpen || filterCount ? 'secondary' : 'outline'} size="sm" className="h-8 gap-1.5 text-xs"
                        aria-expanded={filtersOpen} aria-controls="session-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
                        <SlidersHorizontal className="size-3.5" />Filtros
                        {filterCount > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">{filterCount}</span>}
                        <ChevronDown className={cn('size-3 transition-transform motion-reduce:transition-none', filtersOpen && 'rotate-180')} />
                    </Button>
                </div>
                <ActiveSessionFilters filters={filters} onChange={setFilters} onClearAll={resetFilters} />
            </div>
            {filtersOpen && <SessionFiltersPanel filters={filters} projects={projects} models={models} onChange={setFilters} />}
            <div className="flex min-h-10 items-center justify-between gap-2 px-3 py-1.5">
                <span role="status" className="text-[11px] text-muted-foreground">
                    {isLoading ? 'Atualizando sessões…' : filterCount ? `${visible.length} de ${sessions.length} sessões` : `${sessions.length} ${sessions.length === 1 ? 'sessão' : 'sessões'}`}
                </span>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Atualizar lista" title="Atualizar lista" disabled={isLoading} onClick={() => void refresh()}>
                        <RefreshCw className={cn(isLoading && 'animate-spin motion-reduce:animate-none')} />
                    </Button>
                </div>
            </div>
            {error && <p role="alert" className="mx-3 mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
            <ul aria-label="Sessões" aria-busy={isLoading} className="space-y-2 px-3 pb-3">
                {visible.map((session) => <li key={session.file}><SessionCard session={session} selected={session.file === openedFile} onOpen={() => void openFile(session.file)} /></li>)}
                {isLoading && sessions.length === 0 && Array.from({ length: 3 }, (_, index) => <li key={index} aria-hidden="true" className="h-48 animate-pulse rounded-xl border bg-muted/40 motion-reduce:animate-none" />)}
                {visible.length === 0 && !isLoading && !error && (
                    <li className="px-3 py-10 text-center">
                        <Search className="mx-auto mb-3 size-5 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium">{filterCount ? 'Nenhuma sessão encontrada' : 'Nenhuma sessão disponível'}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{filterCount ? 'Tente outro nome ou amplie os limites dos filtros.' : 'As sessões locais aparecerão aqui. Clique em atualizar após iniciar uma sessão.'}</p>
                        {filterCount > 0 && <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Limpar todos</Button>}
                    </li>
                )}
            </ul>
        </div>
    );
}
