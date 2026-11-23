import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type UIEvent } from 'react';

const STORAGE_KEY = 'z4-viewer-session-view-state';

function savedState(file: string) {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        if (saved?.version === 1 && saved.file === file && saved.values && typeof saved.values === 'object' && !Array.isArray(saved.values)) return saved.values as Record<string, unknown>;
    } catch { /* Storage may be blocked or contain an older format. */ }
    return {};
}

function writeValue(file: string, name: string, value: unknown) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, file, values: { ...savedState(file), [name]: value } }));
    } catch { /* The current viewport still works without persistence. */ }
}

/** Only the last session's camera and display preferences are kept, never log contents. */
export function useSessionViewState<T>(file: string | undefined, name: string, initial: T, valid: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const saved = file ? savedState(file)[name] : undefined;
        return valid(saved) ? saved : initial;
    });
    useEffect(() => { if (file) writeValue(file, name, value); }, [file, name, value]);
    return [value, setValue];
}

export function useRememberedScroll<T extends HTMLElement>(file: string | undefined, name: string, identity = '') {
    const ref = useRef<T>(null);
    useLayoutEffect(() => {
        if (!file || !ref.current) return;
        const saved = savedState(file)[name] as { identity?: string; x?: number; y?: number } | undefined;
        const match = saved?.identity === identity;
        ref.current.scrollLeft = match && Number.isFinite(saved?.x) ? saved!.x! : 0;
        ref.current.scrollTop = match && Number.isFinite(saved?.y) ? saved!.y! : 0;
    }, [file, name, identity]);
    const onScroll = (event: UIEvent<T>) => {
        if (file) writeValue(file, name, { identity, x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop });
    };
    return { ref, onScroll };
}
