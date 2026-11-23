import { create } from 'zustand';
import type { SessionSummary } from '../../../../server/model';
import { defaultFilters, type SessionFilters, type SessionSort, type SortDirection } from '../sessionFilters';
import { readSessionPreferences, saveSessionPreferences } from './sessionPreferences';

export { filterSessions, projectOf, type SessionFilters } from '../sessionFilters';

interface SessionListState {
    sessions: SessionSummary[];
    filters: SessionFilters;
    sort: SessionSort;
    direction: SortDirection;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    setFilters: (filters: Partial<SessionFilters>) => void;
    resetFilters: () => void;
    setSort: (sort: SessionSort) => void;
    toggleDirection: () => void;
}

export const useSessionListStore = create<SessionListState>((set) => ({
    sessions: [],
    ...readSessionPreferences(),
    isLoading: false,
    error: null,
    refresh: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/sessions');
            if (!response.ok) {
                throw new Error(`API retornou HTTP ${response.status}`);
            }
            set({ sessions: await response.json() as SessionSummary[] });
        } catch {
            set({ error: 'Não foi possível carregar as sessões. Verifique a API no terminal e clique em atualizar.' });
        } finally {
            set({ isLoading: false });
        }
    },
    setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
    resetFilters: () => set({ filters: defaultFilters() }),
    setSort: (sort) => set({ sort, direction: sort === 'title' || sort === 'models' ? 'asc' : 'desc' }),
    toggleDirection: () => set((state) => ({ direction: state.direction === 'asc' ? 'desc' : 'asc' })),
}));

useSessionListStore.subscribe((state, previous) => {
    if (state.filters !== previous.filters || state.sort !== previous.sort || state.direction !== previous.direction) {
        saveSessionPreferences(state);
    }
});
