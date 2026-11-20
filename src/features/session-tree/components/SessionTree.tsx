import type Konva from 'konva';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { CANVAS_FONT, useFontsReady } from '@/lib/canvasFont';
import { formatDuration, formatTokens } from '@/lib/format';
import { useCanvasPalette, type CanvasPalette } from '@/lib/theme';
import { treeTokens, type Session } from '../../../../server/model';
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { useSessionStore } from '../store/sessionStore';

const ZOOM_STEP = 1.1;
const PADDING = 16;
const STAT_COLUMN = (NODE_WIDTH - PADDING * 2) / 3;

function statusColor(session: Session, palette: CanvasPalette): string | null {
    switch (session.status) {
        case 'finished':
            return palette.statusFinished;
        case 'failed':
            return palette.statusFailed;
        case 'running':
            return palette.statusRunning;
        default:
            return null;
    }
}

interface NodeCardProps {
    session: Session;
    share: number;
    isSelected: boolean;
    palette: CanvasPalette;
    onSelect: () => void;
    onOpen: () => void;
}

/** One agent: name and status, model, three stats, and its share of the whole session's tokens. */
function NodeCard({ session, share, isSelected, palette, onSelect, onOpen }: NodeCardProps) {
    const toolColor = palette[session.tool];
    const dot = statusColor(session, palette);
    const stats: [string, string][] = [
        [formatTokens(session.tokens.total), 'tokens'],
        [String(session.calls.length), 'chamadas'],
        [formatDuration(session.durationMs), 'duração'],
    ];
    const barWidth = NODE_WIDTH - PADDING * 2 - 44;

    return (
        <Group onClick={onSelect} onTap={onSelect} onDblClick={onOpen} onDblTap={onOpen}>
            <Rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                cornerRadius={12}
                fill={palette.card}
                stroke={isSelected ? palette.borderStrong : palette.border}
                strokeWidth={isSelected ? 1.5 : 1}
                shadowColor="#000000"
                shadowOpacity={palette.shadowOpacity}
                shadowBlur={12}
                shadowOffsetY={2}
            />
            <Circle x={PADDING + 4} y={22} radius={4} fill={toolColor} />
            <Text x={PADDING + 14} y={14} width={NODE_WIDTH - PADDING * 2 - 30} text={session.role} fontFamily={CANVAS_FONT} fontSize={14} fontStyle="600" fill={palette.text} ellipsis wrap="none" />
            {dot && <Circle x={NODE_WIDTH - PADDING - 4} y={22} radius={4} fill={dot} />}
            <Text x={PADDING} y={36} width={NODE_WIDTH - PADDING * 2} text={[session.nickname, session.model ?? 'modelo desconhecido', session.effort].filter(Boolean).join(', ')} fontFamily={CANVAS_FONT} fontSize={12} fill={palette.mutedText} ellipsis wrap="none" />
            {stats.map(([value, label], index) => (
                <Group key={label} x={PADDING + index * STAT_COLUMN} y={60}>
                    <Text text={value} width={STAT_COLUMN - 8} fontFamily={CANVAS_FONT} fontSize={17} fontStyle="600" fill={palette.text} ellipsis wrap="none" />
                    <Text y={21} text={label} fontFamily={CANVAS_FONT} fontSize={11} fill={palette.mutedText} />
                </Group>
            ))}
            <Rect x={PADDING} y={106} width={barWidth} height={4} cornerRadius={2} fill={palette.laneBar} />
            <Rect x={PADDING} y={106} width={Math.max(2, barWidth * share)} height={4} cornerRadius={2} fill={toolColor} />
            <Text x={PADDING + barWidth} y={102} width={44} align="right" text={`${Math.round(share * 100)}%`} fontFamily={CANVAS_FONT} fontSize={11} fill={palette.mutedText} />
        </Group>
    );
}

/** Pannable, zoomable canvas with one card per agent. */
export function SessionTree() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const select = useSessionStore((state) => state.select);
    const setView = useSessionStore((state) => state.setView);
    const palette = useCanvasPalette();
    const fontsReady = useFontsReady();
    const nodes = useMemo(() => (root ? layoutTree(root) : []), [root]);
    const sessionTotal = useMemo(() => (root ? treeTokens(root).total : 0), [root]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
        event.evt.preventDefault();
        const stage = event.target.getStage();
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) {
            return;
        }
        const oldScale = stage.scaleX();
        const scale = event.evt.deltaY < 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP;
        const anchor = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        stage.scale({ x: scale, y: scale });
        stage.position({ x: pointer.x - anchor.x * scale, y: pointer.y - anchor.y * scale });
    }

    return (
        <div ref={containerRef} className="h-full w-full overflow-hidden" style={{ background: palette.background }}>
            {!root && <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Escolha uma sessão na lista para ver os agentes.</p>}
            {root && size.width > 0 && (
                <Stage key={fontsReady ? 'fonts' : 'fallback'} width={size.width} height={size.height} draggable onWheel={handleWheel} x={48} y={48}>
                    <Layer>
                        {nodes.map(({ session, x, y, parent }) => {
                            if (!parent) {
                                return null;
                            }
                            const fromX = parent.x + NODE_WIDTH / 2;
                            const fromY = parent.y + NODE_HEIGHT;
                            const toX = x + NODE_WIDTH / 2;
                            const midY = (fromY + y) / 2;
                            return <Line key={`edge-${session.id}`} points={[fromX, fromY, fromX, midY, toX, midY, toX, y]} stroke={palette.edge} strokeWidth={1.25} lineCap="round" lineJoin="round" />;
                        })}
                        {nodes.map(({ session, x, y }) => (
                            <Group key={session.id} x={x} y={y}>
                                <NodeCard session={session} share={sessionTotal ? session.tokens.total / sessionTotal : 0} isSelected={session.id === selectedId} palette={palette} onSelect={() => select(session.id)} onOpen={() => { select(session.id); setView('activity'); }} />
                            </Group>
                        ))}
                    </Layer>
                </Stage>
            )}
        </div>
    );
}
