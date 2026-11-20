const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Short token counts that fit a stat column: 950, 235k, 9,4M. */
export function formatTokens(value: number): string {
    if (value >= 1_000_000) {
        return `${decimal.format(value / 1_000_000)}M`;
    }
    if (value >= 10_000) {
        return `${Math.round(value / 1000)}k`;
    }
    if (value >= 1000) {
        return `${decimal.format(value / 1000)}k`;
    }
    return String(Math.round(value));
}

/** Short durations: 40s, 2min50, 22min, 1h03. Seconds only show while they still matter. */
export function formatDuration(ms: number | null): string {
    if (ms === null) {
        return '?';
    }
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 10) {
        const seconds = totalSeconds % 60;
        return seconds ? `${minutes}min${String(seconds).padStart(2, '0')}` : `${minutes}min`;
    }
    if (minutes < 60) {
        return `${minutes}min`;
    }
    return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}
