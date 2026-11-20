const TICK_STEPS_MS = [1, 5, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400].map((seconds) => seconds * 1000);
const MIN_TICK_SPACING_PX = 80;

/** The smallest round step that keeps axis labels at least ~80px apart. */
export function pickTickStep(spanMs: number, widthPx: number): number {
    const msPerPx = spanMs / Math.max(1, widthPx);
    return TICK_STEPS_MS.find((step) => step / msPerPx >= MIN_TICK_SPACING_PX) ?? TICK_STEPS_MS.at(-1)!;
}

/** Time since the session started, as shown on the axis: +45s, +12min, +1h05. */
export function formatElapsed(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) {
        return `+${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) {
        const seconds = totalSeconds % 60;
        return seconds ? `+${minutes}min${String(seconds).padStart(2, '0')}` : `+${minutes}min`;
    }
    return `+${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}
