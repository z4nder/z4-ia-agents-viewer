import { create } from 'zustand';
import type { Segment } from '../../../../server/analysis';
import type { Session } from '../../../../server/model';

export type SessionView = 'tree' | 'timeline';

interface SessionState {
    root: Session | null;
    selectedId: string | null;
    /** Timeline only: the block clicked inside the selected agent's lane. */
    selectedSegment: Segment | null;
    view: SessionView;
    error: string | null;
    load: (file: string) => Promise<void>;
    select: (id: string | null, segment?: Segment | null) => void;
    setView: (view: SessionView) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    root: null,
    selectedId: null,
    selectedSegment: null,
    view: 'tree',
    error: null,
    load: async (file) => {
        set({ error: null });
        const response = await fetch(`/api/session?file=${encodeURIComponent(file)}`);
        const body = await response.json();
        if (!response.ok) {
            set({ error: body.error ?? 'Falha ao carregar a sessão', root: null });
            return;
        }
        set({ root: body, selectedId: body.id, selectedSegment: null });
    },
    select: (id, segment = null) => set({ selectedId: id, selectedSegment: segment }),
    setView: (view) => set({ view }),
}));

export function findSession(root: Session | null, id: string | null): Session | null {
    if (!root || !id) {
        return null;
    }
    if (root.id === id) {
        return root;
    }
    for (const child of root.children) {
        const found = findSession(child, id);
        if (found) {
            return found;
        }
    }
    return null;
}
