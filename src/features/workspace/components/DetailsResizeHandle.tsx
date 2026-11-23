import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { clampDetailsWidth, DETAILS_DEFAULT_WIDTH, DETAILS_MIN_WIDTH } from '../store/workspaceStore';

export function DetailsResizeHandle({ width, maxWidth, onChange }: { width: number; maxWidth: number; onChange: (width: number) => void }) {
    const drag = useRef<{ id: number; x: number; width: number } | null>(null);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (!dragging) return;
        const { cursor, userSelect } = document.body.style;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => { document.body.style.cursor = cursor; document.body.style.userSelect = userSelect; };
    }, [dragging]);

    function start(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, width };
        setDragging(true);
    }

    function keyDown(event: KeyboardEvent<HTMLDivElement>) {
        const step = event.shiftKey ? 40 : 16;
        const next = event.key === 'ArrowLeft' ? width + step : event.key === 'ArrowRight' ? width - step
            : event.key === 'Home' ? DETAILS_MIN_WIDTH : event.key === 'End' ? maxWidth : null;
        if (next === null) return;
        event.preventDefault();
        onChange(clampDetailsWidth(next, maxWidth));
    }

    return (
        <div role="separator" aria-label="Redimensionar painel de detalhes" aria-orientation="vertical" aria-controls="workspace-details"
            aria-valuemin={DETAILS_MIN_WIDTH} aria-valuemax={maxWidth} aria-valuenow={width} aria-valuetext={`${width} pixels de largura`}
            tabIndex={0} title="Arraste para ajustar. Setas ajustam a largura; duplo clique restaura."
            className={cn('group absolute inset-y-0 -left-1 z-20 flex w-2 touch-none cursor-col-resize items-center justify-center outline-none focus-visible:bg-sky-500/15', dragging && 'bg-sky-500/15')}
            onPointerDown={start}
            onPointerMove={(event) => {
                if (drag.current?.id === event.pointerId) onChange(clampDetailsWidth(drag.current.width + drag.current.x - event.clientX, maxWidth));
            }}
            onPointerUp={(event) => { drag.current = null; setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={() => { drag.current = null; setDragging(false); }}
            onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
            onDoubleClick={() => onChange(clampDetailsWidth(DETAILS_DEFAULT_WIDTH, maxWidth))}
            onKeyDown={keyDown}>
            <span className={cn('h-9 w-0.5 rounded-full bg-border transition-colors group-hover:bg-sky-500 group-focus-visible:bg-sky-500', dragging && 'bg-sky-500')} />
        </div>
    );
}
