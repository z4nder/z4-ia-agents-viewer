import { create } from 'zustand';
import { useToolboxStore } from '@/features/toolbox/store/toolboxStore';
import type { ActivityItem } from '../../../../server/activity';
import type { Segment } from '../../../../server/analysis';
import type { FlowBlock } from '../../../../server/flow';
import type { Session } from '../../../../server/model';

export type SessionView = 'tree' | 'timeline' | 'flow' | 'activity';

/** What was clicked last; every kind belongs to one agent, so the views can highlight it. */
export type Selection =
    | { type: 'agent'; sessionId: string }
    | { type: 'segment'; sessionId: string; segment: Segment }
    | { type: 'block'; sessionId: string; block: FlowBlock }
    | { type: 'item'; sessionId: string; item: ActivityItem };

interface SessionState {
    root: Session | null;
    selection: Selection | null;
    /** The agent of the current selection. */
    selectedId: string | null;
    view: SessionView;
    error: string | null;
    load: (file: string) => Promise<void>;
    /** Selects something and reveals it in the details tool (unless `reveal` is false). */
    select: (selection: Selection, reveal?: boolean) => void;
    selectAgent: (sessionId: string, reveal?: boolean) => void;
    setView: (view: SessionView) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
    root: null,
    selection: null,
    selectedId: null,
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
        set({ root: body, selection: { type: 'agent', sessionId: body.id }, selectedId: body.id });
    },
    select: (selection, reveal = true) => {
        set({ selection, selectedId: selection.sessionId });
        if (reveal) {
            useToolboxStore.getState().revealDetails();
        }
    },
    selectAgent: (sessionId, reveal = true) => get().select({ type: 'agent', sessionId }, reveal),
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
