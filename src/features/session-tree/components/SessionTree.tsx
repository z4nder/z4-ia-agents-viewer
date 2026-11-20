import type Konva from 'konva';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { formatDuration, formatTokens } from '@/lib/format';
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { useSessionStore } from '../store/sessionStore';

const TOOL_COLORS = { codex: '#0f766e', claude: '#c2410c' } as const;
const ZOOM_STEP = 1.1;

/** Pannable, zoomable canvas with one card per agent. */
export function SessionTree() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const select = useSessionStore((state) => state.select);
    const nodes = useMemo(() => (root ? layoutTree(root) : []), [root]);

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
        <div ref={containerRef} className="h-full w-full overflow-hidden bg-stone-100">
            {size.width > 0 && (
                <Stage width={size.width} height={size.height} draggable onWheel={handleWheel} x={40} y={40}>
                    <Layer>
                        {nodes.map(
                            (node) =>
                                node.parent && (
                                    <Line
                                        key={`edge-${node.session.id}`}
                                        points={[node.parent.x + NODE_WIDTH / 2, node.parent.y + NODE_HEIGHT, node.x + NODE_WIDTH / 2, node.y]}
                                        stroke="#a8a29e"
                                        strokeWidth={1.5}
                                    />
                                ),
                        )}
                        {nodes.map(({ session, x, y }) => {
                            const isSelected = session.id === selectedId;
                            const name = session.nickname ? `${session.role} · ${session.nickname}` : session.role;
                            return (
                                <Group key={session.id} x={x} y={y} onClick={() => select(session.id)} onTap={() => select(session.id)}>
                                    <Rect
                                        width={NODE_WIDTH}
                                        height={NODE_HEIGHT}
                                        cornerRadius={10}
                                        fill="#ffffff"
                                        stroke={isSelected ? '#1c1917' : '#d6d3d1'}
                                        strokeWidth={isSelected ? 2 : 1}
                                        shadowColor="#000000"
                                        shadowOpacity={0.06}
                                        shadowBlur={8}
                                    />
                                    <Rect width={6} height={NODE_HEIGHT} cornerRadius={[10, 0, 0, 10]} fill={TOOL_COLORS[session.tool]} />
                                    <Text x={16} y={12} width={NODE_WIDTH - 28} text={name} fontSize={14} fontStyle="bold" fill="#1c1917" ellipsis wrap="none" />
                                    <Text x={16} y={34} text={session.model ?? '?'} fontSize={12} fill="#78716c" />
                                    <Text
                                        x={16}
                                        y={58}
                                        width={NODE_WIDTH - 28}
                                        ellipsis
                                        wrap="none"
                                        text={`${formatTokens(session.tokens.total)} tokens · ${session.calls.length} chamadas · ${formatDuration(session.durationMs)}`}
                                        fontSize={12}
                                        fill="#44403c"
                                    />
                                </Group>
                            );
                        })}
                    </Layer>
                </Stage>
            )}
        </div>
    );
}
