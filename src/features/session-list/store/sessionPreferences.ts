import { defaultFilters, type NumericRange, type SessionFilters, type SessionSort, type SortDirection } from '../sessionFilters';

const STORAGE_KEY = 'z4-viewer-session-preferences';
const SORTS: SessionSort[] = ['updatedAt', 'title', 'agentCount', 'callCount', 'totalTokens', 'durationMs', 'models'];
const SOURCES: SessionFilters['source'][] = ['all', 'claude', 'codex', 'codex-empresa', 'gravada'];
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface SessionPreferences {
    filters: SessionFilters;
    sort: SessionSort;
    direction: SortDirection;
}

function object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function range(value: unknown): NumericRange {
    const saved = object(value);
    const bound = (value: unknown) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : '';
    return { min: bound(saved.min), max: bound(saved.max) };
}

/** Only preferences are persisted; session contents and transient request state stay in memory. */
export function readSessionPreferences(storage?: PreferenceStorage): SessionPreferences {
    const defaults: SessionPreferences = { filters: defaultFilters(), sort: 'updatedAt', direction: 'desc' };
    try {
        const saved = object(JSON.parse((storage ?? localStorage).getItem(STORAGE_KEY) ?? '{}'));
        if (saved.version !== 1) return defaults;
        const filters = object(saved.filters);
        const text = (key: string) => typeof filters[key] === 'string' ? filters[key] as string : '';
        const date = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(text(key)) ? text(key) : '';
        return {
            filters: {
                query: text('query'), project: text('project'), model: text('model'), from: date('from'), to: date('to'),
                source: SOURCES.includes(filters.source as SessionFilters['source']) ? filters.source as SessionFilters['source'] : 'all',
                agents: range(filters.agents), calls: range(filters.calls), tokens: range(filters.tokens), duration: range(filters.duration),
            },
            sort: SORTS.includes(saved.sort as SessionSort) ? saved.sort as SessionSort : defaults.sort,
            direction: saved.direction === 'asc' || saved.direction === 'desc' ? saved.direction : defaults.direction,
        };
    } catch {
        return defaults;
    }
}

export function saveSessionPreferences(preferences: SessionPreferences, storage?: PreferenceStorage): void {
    try {
        (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify({
            version: 1, filters: preferences.filters, sort: preferences.sort, direction: preferences.direction,
        }));
    } catch {
        // Storage can be blocked or full; filtering still works for this visit.
    }
}
