import { create } from 'zustand';
import type { SessionSource, SessionSummary } from '../../../../server/model';

export interface SessionFilters {
    source: SessionSource | 'all';
    project: string;
    from: string;
    to: string;
}

interface SessionListState {
    sessions: SessionSummary[];
    filters: SessionFilters;
    isLoading: boolean;
    refresh: () => Promise<void>;
    setFilters: (filters: Partial<SessionFilters>) => void;
}

export const useSessionListStore = create<SessionListState>((set) => ({
    sessions: [],
    filters: { source: 'all', project: '', from: '', to: '' },
    isLoading: false,
    refresh: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch('/api/sessions');
            set({ sessions: await response.json() });
        } finally {
            set({ isLoading: false });
        }
    },
    setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
}));

export function projectOf(session: SessionSummary): string {
    return session.cwd?.split('/').filter(Boolean).at(-1) ?? '?';
}

/** `from`/`to` are yyyy-mm-dd from the date inputs; a session matches when it was updated inside the range. */
export function filterSessions(sessions: SessionSummary[], filters: SessionFilters): SessionSummary[] {
    return sessions.filter((session) => {
        const day = session.updatedAt.slice(0, 10);
        return (
            (filters.source === 'all' || session.source === filters.source) &&
            (!filters.project || projectOf(session) === filters.project) &&
            (!filters.from || day >= filters.from) &&
            (!filters.to || day <= filters.to)
        );
    });
}
