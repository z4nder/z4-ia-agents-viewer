import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { CANVAS_FONT, useFontsReady } from '@/lib/canvasFont';
import { formatTokens } from '@/lib/format';
import { useCanvasPalette, type CanvasPalette } from '@/lib/theme';
import { buildTimeline, type ProcessResult, type Segment } from '../../../../server/analysis';
import { formatElapsed, pickTickStep } from '../timeScale';
import { TimelineLegend } from './TimelineLegend';

const LABEL_WIDTH = 232;
const ROW_HEIGHT = 52;
const AXIS_HEIGHT = 32;
const ZOOM_STEP = 1.2;
const MIN_SPAN_MS = 2_000;

interface Range {
    start: number;
    end: number;
}

export function processColor(result: ProcessResult | undefined, palette: CanvasPalette): string {
    if (result === 'passed') {
        return palette.processPassed;
    }
    return result === 'failed' ? palette.failed : palette.processInconclusive;
}

/**
 * Gantt-style view: one lane per agent. Amber blocks are waits (polls merged), the lower bar marks long
 * processes by result, dark ticks are tool calls and dots on top are model calls.
 * Wheel zooms around the pointer, dragging pans, double click fits the whole session.
 */
export function Timeline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ x: number; range: Range } | null>(null);
    const [width, setWidth] = useState(0);
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const selectedSegment = useSessionStore((state) => state.selectedSegment);
    const select = useSessionStore((state) => state.select);
    const palette = useCanvasPalette();
    const fontsReady = useFontsReady();
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
        return (
            <div ref={containerRef} className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Escolha uma sessão na lista para ver a linha do tempo.
            </div>
        );
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
    const text = { fontFamily: CANVAS_FONT, listening: false } as const;

    function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds || !visible) {
            return;
        }
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
            const shift = ((event.shiftKey ? event.deltaY : event.deltaX) / plotWidth) * span;
            setRange({ start: visible.start + shift, end: visible.end + shift });
            return;
        }
        const anchor = timeAt(Math.max(LABEL_WIDTH, event.clientX - bounds.left));
        const nextSpan = Math.max(MIN_SPAN_MS, event.deltaY < 0 ? span / ZOOM_STEP : span * ZOOM_STEP);
        const ratio = (anchor - visible.start) / span;
        setRange({ start: anchor - ratio * nextSpan, end: anchor + (1 - ratio) * nextSpan });
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (visible) {
            dragRef.current = { x: event.clientX, range: visible };
        }
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || event.buttons !== 1 || Math.abs(drag.x - event.clientX) <= 3) {
            return;
        }
        const shift = ((drag.x - event.clientX) / plotWidth) * (drag.range.end - drag.range.start);
        setRange({ start: drag.range.start + shift, end: drag.range.end + shift });
    }

    const byLongestFirst = (a: Segment, b: Segment) => b.end - b.start - (a.end - a.start);

    return (
        <div className="flex h-full flex-col">
            <TimelineLegend />
            <div
                ref={containerRef}
                className="min-h-0 flex-1 touch-none overflow-x-hidden overflow-y-auto select-none"
                style={{ background: palette.card }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => (dragRef.current = null)}
                onDoubleClick={() => setRange(null)}
            >
                {width > 0 && (
                    <Stage key={fontsReady ? 'fonts' : 'fallback'} width={width} height={height}>
                        <Layer>
                            {timeline.lanes.map((lane, index) => (
                                <Rect
                                    key={`row-${lane.sessionId}`}
                                    y={AXIS_HEIGHT + index * ROW_HEIGHT}
                                    width={width}
                                    height={ROW_HEIGHT}
                                    fill={lane.sessionId === selectedId ? palette.rowSelected : index % 2 ? palette.rowAlt : palette.card}
                                    listening={false}
                                />
                            ))}
                            {ticks.map((tick) => (
                                <Line key={`grid-${tick}`} points={[toX(tick), AXIS_HEIGHT, toX(tick), height]} stroke={palette.grid} strokeWidth={1} listening={false} />
                            ))}
                            <Group clipX={LABEL_WIDTH} clipY={0} clipWidth={plotWidth} clipHeight={height}>
                                {timeline.lanes.map((lane, index) => {
                                    const top = AXIS_HEIGHT + index * ROW_HEIGHT;
                                    const callColor = palette[findSession(root, lane.sessionId)?.tool ?? 'codex'];
                                    const widthOf = (segment: Segment, minimum: number) => Math.max(minimum, toX(segment.end) - toX(segment.start));
                                    return (
                                        <Group key={lane.sessionId}>
                                            <Rect x={toX(lane.start)} y={top + 20} width={Math.max(1, toX(lane.end) - toX(lane.start))} height={12} fill={palette.laneBar} cornerRadius={3} listening={false} />
                                            {lane.segments
                                                .filter((segment) => segment.kind === 'waiting')
                                                .map((segment) => (
                                                    <Rect
                                                        key={`w-${segment.start}`}
                                                        x={toX(segment.start)}
                                                        y={top + 8}
                                                        width={widthOf(segment, 2)}
                                                        height={ROW_HEIGHT - 16}
                                                        fill={palette.waiting}
                                                        opacity={segment === selectedSegment ? 0.85 : palette.waitingOpacity}
                                                        cornerRadius={4}
                                                        onClick={() => select(lane.sessionId, segment)}
                                                    />
                                                ))}
                                            {lane.segments
                                                .filter((segment) => segment.kind === 'tool')
                                                .map((segment, toolIndex) => (
                                                    <Rect
                                                        key={`t-${toolIndex}`}
                                                        x={toX(segment.start)}
                                                        y={top + 20}
                                                        width={widthOf(segment, 1.5)}
                                                        height={12}
                                                        fill={segment.ok === false ? palette.failed : palette.tool}
                                                        opacity={segment === selectedSegment ? 1 : 0.7}
                                                        onClick={() => select(lane.sessionId, segment)}
                                                    />
                                                ))}
                                            {lane.segments
                                                .filter((segment) => segment.kind === 'process')
                                                .sort(byLongestFirst)
                                                .map((segment) => (
                                                    <Rect
                                                        key={`p-${segment.start}`}
                                                        x={toX(segment.start)}
                                                        y={top + 36}
                                                        width={widthOf(segment, 2)}
                                                        height={6}
                                                        fill={processColor(segment.result, palette)}
                                                        stroke={segment === selectedSegment ? palette.borderStrong : undefined}
                                                        cornerRadius={3}
                                                        onClick={() => select(lane.sessionId, segment)}
                                                    />
                                                ))}
                                            {lane.callTimes.map((time, callIndex) => (
                                                <Circle key={`c-${callIndex}`} x={toX(time)} y={top + 12} radius={1.8} fill={callColor} listening={false} />
                                            ))}
                                        </Group>
                                    );
                                })}
                            </Group>
                            <Rect width={LABEL_WIDTH} height={height} fill={palette.card} opacity={0.94} listening={false} />
                            <Line points={[LABEL_WIDTH, 0, LABEL_WIDTH, height]} stroke={palette.border} strokeWidth={1} listening={false} />
                            {timeline.lanes.map((lane, index) => {
                                const top = AXIS_HEIGHT + index * ROW_HEIGHT;
                                const indent = 16 + lane.depth * 14;
                                const waitingShare = lane.end > lane.start ? Math.round((lane.stats.waitingMs / (lane.end - lane.start)) * 100) : 0;
                                const isSelected = lane.sessionId === selectedId;
                                return (
                                    <Group key={`label-${lane.sessionId}`} y={top} onClick={() => select(lane.sessionId)}>
                                        <Rect width={LABEL_WIDTH} height={ROW_HEIGHT} fill="transparent" />
                                        <Text {...text} x={indent} y={10} width={LABEL_WIDTH - indent - 12} text={lane.label} fontSize={13} fontStyle={isSelected ? '600' : '500'} fill={palette.text} ellipsis wrap="none" />
                                        <Text {...text} x={indent} y={30} text={`${formatTokens(lane.stats.tokens)} tokens`} fontSize={11} fill={palette.mutedText} />
                                        <Text {...text} x={indent + 96} y={30} text={`${waitingShare}% esperando`} fontSize={11} fill={waitingShare >= 50 ? palette.waiting : palette.mutedText} />
                                    </Group>
                                );
                            })}
                            <Rect width={width} height={AXIS_HEIGHT} fill={palette.card} listening={false} />
                            <Line points={[0, AXIS_HEIGHT, width, AXIS_HEIGHT]} stroke={palette.border} strokeWidth={1} listening={false} />
                            {ticks
                                .filter((tick) => toX(tick) >= LABEL_WIDTH)
                                .map((tick) => (
                                    <Text {...text} key={`tick-${tick}`} x={toX(tick) + 4} y={11} text={formatElapsed(tick - timeline.start)} fontSize={11} fill={palette.mutedText} />
                                ))}
                            <Text {...text} x={16} y={11} text="Agente" fontSize={11} fill={palette.mutedText} />
                        </Layer>
                    </Stage>
                )}
            </div>
        </div>
    );
}
