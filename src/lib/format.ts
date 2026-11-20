const compactNumber = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatTokens(value: number): string {
    return compactNumber.format(value);
}

export function formatDuration(ms: number | null): string {
    if (ms === null) {
        return '?';
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
}
