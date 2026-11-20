import { useEffect, useState } from 'react';

/** Same family as the page; Konva needs it spelled out because canvas text doesn't inherit CSS. */
export const CANVAS_FONT = "'Geist Variable', sans-serif";

/** Re-renders once the web font is loaded, otherwise the canvas keeps the fallback font it drew with. */
export function useFontsReady(): boolean {
    const [isReady, setIsReady] = useState(() => document.fonts.status === 'loaded');
    useEffect(() => {
        let isMounted = true;
        void document.fonts.ready.then(() => isMounted && setIsReady(true));
        return () => {
            isMounted = false;
        };
    }, []);
    return isReady;
}
