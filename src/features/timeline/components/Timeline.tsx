import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { formatTokens } from '@/lib/format';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildTimeline, type Segment } from '../../../../server/analysis';
import { formatElapsed, pickTickStep } from '../timeScale';

const LABEL_WIDTH = 220;
const ROW_HEIGHT = 44;
const AXIS_HEIGHT = 28;
const ZOOM_STEP = 1.2;
const MIN_SPAN_MS = 2_000;

const PROCESS_COLORS = { passed: '#2563eb', failed: '#dc2626', inconclusive: '#78716c' } as const;
const CALL_COLORS = { codex: '#0f766e', claude: '#c2410c' } as const;

interface Range {
    start: number;
    end: number;
}

/**
 * Gantt-style view: one lane per agent. Amber blocks are waits (polls merged), the lower bar marks long
 * processes by result, dark ticks are tool calls and dots on top are model calls.
 * Wheel zooms around the pointer, dragging pans.
 */
export function Timeline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ x: number; range: Range } | null>(null);
    const [width, setWidth] = useState(0);
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const selectedSegment = useSessionStore((state) => state.selectedSegment);
    const select = useSessionStore((state) => state.select);
    const timeline = useMemo(() => (root ? buildTimeline(root) : null), [root]);
    const fullRange = useMemo<Range | null>(() => {
        if (!timeline || !Number.isFinite(timeline.start)) {
            return null;
        }
        const padding = (timeline.end - timeline.start) * 0.02;
        return { start: timeline.start - padding, end: timeline.end + padding };
    }, [timeline]);
    const [range, setRange] = useState<Range | null>(null);
    const visible = range ?? fullRange;

    useLayoutEffect(() => setRange(null), [fullRange]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    if (!timeline || !visible) {
        return <div ref={containerRef} className="flex h-full items-center justify-center text-sm text-stone-500">Abra uma sessão na lista.</div>;
    }

    const plotWidth = Math.max(1, width - LABEL_WIDTH);
    const span = visible.end - visible.start;
    const toX = (time: number) => LABEL_WIDTH + ((time - visible.start) / span) * plotWidth;
    const timeAt = (x: number) => visible.start + ((x - LABEL_WIDTH) / plotWidth) * span;
    const height = AXIS_HEIGHT + timeline.lanes.length * ROW_HEIGHT + 8;
    const tickStep = pickTickStep(span, plotWidth);
    const firstTick = Math.ceil((visible.start - timeline.start) / tickStep) * tickStep + timeline.start;
    const ticks: number[] = [];
    for (let tick = firstTick; tick <= visible.end; tick += tickStep) {
        ticks.push(tick);
    }

    function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds || !visible) {
            return;
        }
        const x = event.clientX - bounds.left;
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
            const shift = ((event.shiftKey ? event.deltaY : event.deltaX) / plotWidth) * span;
            setRange({ start: visible.start + shift, end: visible.end + shift });
            return;
        }
        const anchor = timeAt(Math.max(LABEL_WIDTH, x));
        const nextSpan = Math.max(MIN_SPAN_MS, event.deltaY < 0 ? span / ZOOM_STEP : span * ZOOM_STEP);
        const ratio = (anchor - visible.start) / span;
        setRange({ start: anchor - ratio * nextSpan, end: anchor + (1 - ratio) * nextSpan });
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (!visible) {
            return;
        }
        dragRef.current = { x: event.clientX, range: visible };
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || event.buttons !== 1) {
            return;
        }
        const shift = ((drag.x - event.clientX) / plotWidth) * (drag.range.end - drag.range.start);
        if (Math.abs(drag.x - event.clientX) > 3) {
            setRange({ start: drag.range.start + shift, end: drag.range.end + shift });
        }
    }

    return (
        <div
            ref={containerRef}
            className="h-full w-full touch-none overflow-x-hidden overflow-y-auto bg-white select-none"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => (dragRef.current = null)}
            onDoubleClick={() => setRange(null)}
        >
            {width > 0 && (
                <Stage width={width} height={height}>
                    <Layer>
                        {timeline.lanes.map((lane, index) => (
                            <Rect key={`row-${lane.sessionId}`} x={0} y={AXIS_HEIGHT + index * ROW_HEIGHT} width={width} height={ROW_HEIGHT} fill={lane.sessionId === selectedId ? '#f5f5f4' : index % 2 ? '#fafaf9' : '#ffffff'} />
                        ))}
                        {ticks.map((tick) => (
                            <Line key={`grid-${tick}`} points={[toX(tick), AXIS_HEIGHT, toX(tick), height]} stroke="#e7e5e4" strokeWidth={1} />
                        ))}
                        <Group clipX={LABEL_WIDTH} clipY={0} clipWidth={plotWidth} clipHeight={height}>
                            {timeline.lanes.map((lane, index) => {
                                const top = AXIS_HEIGHT + index * ROW_HEIGHT;
                                const tool = findSession(root, lane.sessionId)?.tool ?? 'codex';
                                const bySpanDesc = (a: Segment, b: Segment) => b.end - b.start - (a.end - a.start);
                                return (
                                    <Group key={lane.sessionId}>
                                        <Rect x={toX(lane.start)} y={top + 16} width={Math.max(1, toX(lane.end) - toX(lane.start))} height={12} fill="#e7e5e4" cornerRadius={3} />
                                        {lane.segments
                                            .filter((segment) => segment.kind === 'waiting')
                                            .map((segment) => (
                                                <Rect
                                                    key={`w-${segment.start}`}
                                                    x={toX(segment.start)}
                                                    y={top + 6}
                                                    width={Math.max(2, toX(segment.end) - toX(segment.start))}
                                                    height={ROW_HEIGHT - 12}
                                                    fill="#f59e0b"
                                                    opacity={segment === selectedSegment ? 0.75 : 0.4}
                                                    cornerRadius={3}
                                                    onClick={() => select(lane.sessionId, segment)}
                                                />
                                            ))}
                                        {lane.segments
                                            .filter((segment) => segment.kind === 'tool')
                                            .map((segment, toolIndex) => (
                                                <Rect
                                                    key={`t-${toolIndex}`}
                                                    x={toX(segment.start)}
                                                    y={top + 16}
                                                    width={Math.max(1.5, toX(segment.end) - toX(segment.start))}
                                                    height={12}
                                                    fill={segment.ok === false ? '#dc2626' : '#57534e'}
                                                    opacity={segment === selectedSegment ? 1 : 0.75}
                                                    onClick={() => select(lane.sessionId, segment)}
                                                />
                                            ))}
                                        {lane.segments
                                            .filter((segment) => segment.kind === 'process')
                                            .sort(bySpanDesc)
                                            .map((segment) => (
                                                <Rect
                                                    key={`p-${segment.start}`}
                                                    x={toX(segment.start)}
                                                    y={top + 31}
                                                    width={Math.max(2, toX(segment.end) - toX(segment.start))}
                                                    height={7}
                                                    fill={PROCESS_COLORS[segment.result ?? 'inconclusive']}
                                                    stroke={segment === selectedSegment ? '#1c1917' : undefined}
                                                    cornerRadius={2}
                                                    onClick={() => select(lane.sessionId, segment)}
                                                />
                                            ))}
                                        {lane.callTimes.map((time, callIndex) => (
                                            <Circle key={`c-${callIndex}`} x={toX(time)} y={top + 9} radius={1.8} fill={CALL_COLORS[tool]} listening={false} />
                                        ))}
                                    </Group>
                                );
                            })}
                        </Group>
                        <Rect x={0} y={0} width={LABEL_WIDTH} height={height} fill="#ffffff" opacity={0.92} listening={false} />
                        <Line points={[LABEL_WIDTH, 0, LABEL_WIDTH, height]} stroke="#d6d3d1" strokeWidth={1} />
                        {timeline.lanes.map((lane, index) => {
                            const top = AXIS_HEIGHT + index * ROW_HEIGHT;
                            const waitingShare = lane.end > lane.start ? Math.round((lane.stats.waitingMs / (lane.end - lane.start)) * 100) : 0;
                            return (
                                <Group key={`label-${lane.sessionId}`} x={12 + lane.depth * 14} y={top} onClick={() => select(lane.sessionId)}>
                                    <Rect width={LABEL_WIDTH - 12 - lane.depth * 14} height={ROW_HEIGHT} fill="transparent" />
                                    <Text y={8} width={LABEL_WIDTH - 24 - lane.depth * 14} text={lane.label} fontSize={13} fontStyle={lane.sessionId === selectedId ? 'bold' : 'normal'} fill="#1c1917" ellipsis wrap="none" />
                                    <Text y={26} text={`${formatTokens(lane.stats.tokens)} tokens · ${waitingShare}% esperando`} fontSize={11} fill="#78716c" />
                                </Group>
                            );
                        })}
                        <Rect x={0} y={0} width={width} height={AXIS_HEIGHT} fill="#ffffff" listening={false} />
                        <Line points={[0, AXIS_HEIGHT, width, AXIS_HEIGHT]} stroke="#d6d3d1" strokeWidth={1} />
                        {ticks
                            .filter((tick) => toX(tick) >= LABEL_WIDTH)
                            .map((tick) => (
                                <Text key={`tick-${tick}`} x={toX(tick) + 4} y={9} text={formatElapsed(tick - timeline.start)} fontSize={11} fill="#78716c" listening={false} />
                            ))}
                        <Text x={12} y={9} text="Agente" fontSize={11} fill="#78716c" listening={false} />
                    </Layer>
                </Stage>
            )}
        </div>
    );
}

