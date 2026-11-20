import { create } from 'zustand';

export type ToolPanel = 'sessions' | 'details' | 'views';

const STORAGE_KEY = 'z4-viewer-toolbox';

function readSaved(): { panel: ToolPanel; isOpen: boolean } {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        const panel: ToolPanel = ['sessions', 'details', 'views'].includes(saved.panel) ? saved.panel : 'sessions';
        return { panel, isOpen: saved.isOpen !== false };
    } catch {
        return { panel: 'sessions', isOpen: true };
    }
}

function save(panel: ToolPanel, isOpen: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ panel, isOpen }));
    } catch {
        // Private mode: the toolbox just opens with the default next time.
    }
}

interface ToolboxState {
    panel: ToolPanel;
    isOpen: boolean;
    /** Something new was selected while the details panel wasn't visible. */
    hasUnseenDetails: boolean;
    /** Clicking the open tool collapses the panel; any other tool opens it. */
    toggle: (panel: ToolPanel) => void;
    /** Called on a click in a view: show the details if the panel is open, otherwise flag them. */
    revealDetails: () => void;
}

export const useToolboxStore = create<ToolboxState>((set, get) => ({
    ...readSaved(),
    hasUnseenDetails: false,
    toggle: (panel) => {
        const { panel: current, isOpen } = get();
        const nextOpen = !(isOpen && current === panel);
        save(panel, nextOpen);
        set({ panel, isOpen: nextOpen, hasUnseenDetails: panel === 'details' && nextOpen ? false : get().hasUnseenDetails });
    },
    revealDetails: () => {
        const { isOpen } = get();
        if (isOpen) {
            save('details', true);
            set({ panel: 'details', hasUnseenDetails: false });
        } else {
            set({ hasUnseenDetails: true });
        }
    },
}));
