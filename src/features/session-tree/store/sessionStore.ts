import { create } from 'zustand';
import type { Session } from '../../../../server/model';

interface SessionState {
    root: Session | null;
    selectedId: string | null;
    error: string | null;
    load: (file: string) => Promise<void>;
    select: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    root: null,
    selectedId: null,
    error: null,
    load: async (file) => {
        set({ error: null });
        const response = await fetch(`/api/session?file=${encodeURIComponent(file)}`);
        const body = await response.json();
        if (!response.ok) {
            set({ error: body.error ?? 'Falha ao carregar a sessão', root: null });
            return;
        }
        set({ root: body, selectedId: body.id });
    },
    select: (id) => set({ selectedId: id }),
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
