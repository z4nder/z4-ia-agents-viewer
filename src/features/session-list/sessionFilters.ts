import type { SessionSource, SessionSummary } from '../../../server/model';

export interface NumericRange {
    min: string;
    max: string;
}

export interface SessionFilters {
    query: string;
    source: SessionSource | 'all';
    project: string;
    model: string;
    from: string;
    to: string;
    agents: NumericRange;
    calls: NumericRange;
    tokens: NumericRange;
    /** Duration inputs use minutes. */
    duration: NumericRange;
}

export type SessionSort = 'updatedAt' | 'title' | 'agentCount' | 'callCount' | 'totalTokens' | 'durationMs' | 'models';
export type SortDirection = 'asc' | 'desc';

export function defaultFilters(): SessionFilters {
    return {
        query: '', source: 'all', project: '', model: '', from: '', to: '',
        agents: { min: '', max: '' }, calls: { min: '', max: '' },
        tokens: { min: '', max: '' }, duration: { min: '', max: '' },
    };
}

export function projectOf(session: SessionSummary): string {
    return session.cwd?.split('/').filter(Boolean).at(-1) ?? '?';
}

function normalized(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

function inRange(value: number | null, range: NumericRange): boolean {
    if (range.min === '' && range.max === '') return true;
    if (value === null) return false;
    return (range.min === '' || value >= Number(range.min)) && (range.max === '' || value <= Number(range.max));
}

function localDay(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function filterSessions(sessions: SessionSummary[], filters: SessionFilters): SessionSummary[] {
    const query = normalized(filters.query.trim());
    return sessions.filter((session) => {
        const day = localDay(session.updatedAt);
        return (
            (!query || normalized(session.title ?? '').includes(query)) &&
            (filters.source === 'all' || session.source === filters.source) &&
            (!filters.project || projectOf(session) === filters.project) &&
            (!filters.model || session.models.includes(filters.model)) &&
            (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to) &&
            inRange(session.agentCount, filters.agents) && inRange(session.callCount, filters.calls) &&
            inRange(session.totalTokens, filters.tokens) &&
            inRange(session.durationMs === null ? null : session.durationMs / 60_000, filters.duration)
        );
    });
}

export function sortSessions(sessions: SessionSummary[], sort: SessionSort, direction: SortDirection): SessionSummary[] {
    const sign = direction === 'asc' ? 1 : -1;
    return [...sessions].sort((a, b) => {
        const left = sort === 'models' ? a.models.join(', ') || null : a[sort];
        const right = sort === 'models' ? b.models.join(', ') || null : b[sort];
        // Missing data always goes last, whichever direction is selected.
        if (left === null && right !== null) return 1;
        if (right === null && left !== null) return -1;
        const compared = typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left ?? '').localeCompare(String(right ?? ''), 'pt-BR', { numeric: true });
        return sign * compared || a.file.localeCompare(b.file);
    });
}

export function activeFilterCount(filters: SessionFilters): number {
    return Number(Boolean(filters.query.trim())) + Number(filters.source !== 'all') +
        Number(Boolean(filters.project)) + Number(Boolean(filters.model)) +
        Number(Boolean(filters.from || filters.to)) +
        [filters.agents, filters.calls, filters.tokens, filters.duration].filter((range) => range.min !== '' || range.max !== '').length;
}
