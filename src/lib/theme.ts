import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'z4-viewer-theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        return 'system';
    }
}

function resolve(preference: ThemePreference): ResolvedTheme {
    return preference === 'system' ? (darkQuery.matches ? 'dark' : 'light') : preference;
}

function apply(theme: ResolvedTheme): void {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
}

interface ThemeState {
    preference: ThemePreference;
    resolved: ResolvedTheme;
    setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
    preference: readPreference(),
    resolved: resolve(readPreference()),
    setPreference: (preference) => {
        try {
            if (preference === 'system') {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, preference);
            }
        } catch {
            // Private mode: the choice just isn't remembered.
        }
        const resolved = resolve(preference);
        apply(resolved);
        set({ preference, resolved });
    },
}));

darkQuery.addEventListener('change', () => {
    const { preference } = useThemeStore.getState();
    if (preference === 'system') {
        const resolved = resolve(preference);
        apply(resolved);
        useThemeStore.setState({ resolved });
    }
});

/**
 * Konva paints on a canvas and can't read the CSS variables, so each theme has its own palette,
 * picked to match shadcn's neutral base color.
 */
export const canvasPalettes = {
    light: {
        background: '#f5f5f5',
        card: '#ffffff',
        border: '#e5e5e5',
        borderStrong: '#171717',
        text: '#171717',
        mutedText: '#737373',
        edge: '#a3a3a3',
        grid: '#ededed',
        rowAlt: '#fafafa',
        rowSelected: '#f0f0f0',
        laneBar: '#e5e5e5',
        tool: '#525252',
        failed: '#dc2626',
        waiting: '#f59e0b',
        processPassed: '#2563eb',
        processInconclusive: '#737373',
        codex: '#0f766e',
        claude: '#7c3aed',
        statusFinished: '#16a34a',
        statusFailed: '#dc2626',
        statusRunning: '#2563eb',
        shadowOpacity: 0.06,
        waitingOpacity: 0.3,
        agent: '#059669',
        message: '#2563eb',
    },
    dark: {
        background: '#0a0a0a',
        card: '#171717',
        border: '#2e2e2e',
        borderStrong: '#fafafa',
        text: '#fafafa',
        mutedText: '#a3a3a3',
        edge: '#525252',
        grid: '#1f1f1f',
        rowAlt: '#111111',
        rowSelected: '#1f1f1f',
        laneBar: '#262626',
        tool: '#a3a3a3',
        failed: '#f87171',
        waiting: '#f59e0b',
        processPassed: '#60a5fa',
        processInconclusive: '#a3a3a3',
        codex: '#2dd4bf',
        claude: '#a78bfa',
        statusFinished: '#4ade80',
        statusFailed: '#f87171',
        statusRunning: '#60a5fa',
        shadowOpacity: 0,
        waitingOpacity: 0.5,
        agent: '#34d399',
        message: '#60a5fa',
    },
} as const;

export type CanvasPalette = (typeof canvasPalettes)[ResolvedTheme];

export function useCanvasPalette(): CanvasPalette {
    return canvasPalettes[useThemeStore((state) => state.resolved)];
}
