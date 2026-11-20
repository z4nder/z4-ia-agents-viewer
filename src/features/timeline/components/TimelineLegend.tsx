import type { CSSProperties } from 'react';
import { useCanvasPalette } from '@/lib/theme';

/** Reads the canvas colors so the legend always matches what is drawn. */
export function TimelineLegend() {
    const palette = useCanvasPalette();
    const items: [string, CSSProperties][] = [
        ['Esperando', { background: palette.waiting, opacity: 0.45, height: 12 }],
        ['Ferramenta', { background: palette.tool, width: 3, height: 12 }],
        ['Chamada ao modelo', { background: palette.codex, width: 5, height: 5, borderRadius: 999 }],
        ['Processo passou', { background: palette.processPassed, height: 5 }],
        ['falhou', { background: palette.failed, height: 5 }],
        ['inconclusivo', { background: palette.processInconclusive, height: 5 }],
    ];

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground">
            {items.map(([label, style]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 rounded-sm" style={style} />
                    {label}
                </span>
            ))}
            <span className="ml-auto hidden lg:inline">Roda do mouse aproxima, arrastar move, duplo clique mostra tudo</span>
        </div>
    );
}
