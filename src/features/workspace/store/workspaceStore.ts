import { create } from 'zustand';

export const DETAILS_MIN_WIDTH = 280;
export const DETAILS_MAX_WIDTH = 640;
export const DETAILS_DEFAULT_WIDTH = 360;
const STORAGE_KEY = 'z4-viewer-workspace';

interface Layout {
    sessionsOpen: boolean;
    detailsOpen: boolean;
    detailsWidth: number;
}

function readLayout(): Layout {
    const defaults = { sessionsOpen: true, detailsOpen: true, detailsWidth: DETAILS_DEFAULT_WIDTH };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        if (!saved || saved.version !== 1) return defaults;
        return {
            sessionsOpen: typeof saved.sessionsOpen === 'boolean' ? saved.sessionsOpen : true,
            detailsOpen: typeof saved.detailsOpen === 'boolean' ? saved.detailsOpen : true,
            detailsWidth: typeof saved.detailsWidth === 'number' && Number.isFinite(saved.detailsWidth)
                ? clampDetailsWidth(saved.detailsWidth) : DETAILS_DEFAULT_WIDTH,
        };
    } catch {
        return defaults;
    }
}

export function clampDetailsWidth(width: number, max = DETAILS_MAX_WIDTH): number {
    return Math.round(Math.max(DETAILS_MIN_WIDTH, Math.min(max, width)));
}

interface WorkspaceState extends Layout {
    mobilePanel: 'sessions' | 'details' | null;
    hasUnseenDetails: boolean;
    toggleSessions: () => void;
    toggleDetails: () => void;
    setDetailsWidth: (width: number) => void;
    setMobilePanel: (panel: 'sessions' | 'details' | null) => void;
    notifySelection: () => void;
    acknowledgeDetails: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
    ...readLayout(),
    mobilePanel: null,
    hasUnseenDetails: false,
    toggleSessions: () => set((state) => ({ sessionsOpen: !state.sessionsOpen })),
    toggleDetails: () => set((state) => ({ detailsOpen: !state.detailsOpen, hasUnseenDetails: false })),
    setDetailsWidth: (width) => {
        if (Number.isFinite(width)) set({ detailsWidth: clampDetailsWidth(width) });
    },
    setMobilePanel: (mobilePanel) => set({ mobilePanel }),
    notifySelection: () => set({ hasUnseenDetails: true }),
    acknowledgeDetails: () => set({ hasUnseenDetails: false }),
}));

useWorkspaceStore.subscribe((state, previous) => {
    if (state.sessionsOpen === previous.sessionsOpen && state.detailsOpen === previous.detailsOpen && state.detailsWidth === previous.detailsWidth) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 1, sessionsOpen: state.sessionsOpen, detailsOpen: state.detailsOpen, detailsWidth: state.detailsWidth,
        }));
    } catch {
        // The layout remains usable when storage is unavailable.
    }
});
