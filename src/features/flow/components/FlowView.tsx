import { useMemo } from 'react';
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildAgentNames } from '@/lib/agentNames';
import { CANVAS_FONT, useFontsReady } from '@/lib/canvasFont';
import { useCanvasPalette, type CanvasPalette } from '@/lib/theme';
import { buildFlow, type FlowBlock, type FlowEdge } from '../../../../server/flow';
import { blockCounts, blockSkills, blockTitle } from '../blockText';

const COLUMN_WIDTH = 300;
const COLUMN_GAP = 96;
const SIDE_PADDING = 32;
const TOP_PADDING = 16;
const ROW_GAP = 10;
const HEIGHTS: Record<FlowBlock['kind'], number> = { work: 60, waiting: 34, spawn: 32, send: 32, receive: 32 };
/** Work blocks that used a skill get one more line for it. */
const SKILL_LINE = 18;

function heightOf(block: FlowBlock): number {
    return HEIGHTS[block.kind] + (block.kind === 'work' && blockSkills(block) ? SKILL_LINE : 0);
}

interface PlacedBlock {
    block: FlowBlock;
    x: number;
    y: number;
    height: number;
}

function edgeStyle(edge: FlowEdge, palette: CanvasPalette): { color: string; dash?: number[]; label: string } {
    switch (edge.kind) {
        case 'spawn':
            return { color: palette.agent, label: 'delegou' };
        case 'message':
            return { color: palette.message, label: 'mensagem' };
        case 'return':
            return { color: palette.agent, dash: [6, 4], label: 'voltou' };
    }
}

/**
 * Sequence diagram: one column per agent, blocks in time order top to bottom, and arrows for each
 * delegation, message and return. Click a block to select its agent; double click opens its activity.
 */
export function FlowView() {
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const select = useSessionStore((state) => state.select);
    const selectAgent = useSessionStore((state) => state.selectAgent);
    const selectedBlockId = useSessionStore((state) => (state.selection?.type === 'block' ? state.selection.block.id : null));
    const setView = useSessionStore((state) => state.setView);
    const palette = useCanvasPalette();
    const fontsReady = useFontsReady();
    const flow = useMemo(() => (root ? buildFlow(root) : null), [root]);
    const nameOf = useMemo(() => (root ? buildAgentNames(root) : () => ''), [root]);

    const layout = useMemo(() => {
        if (!flow) {
            return null;
        }
        const columnOf = new Map(flow.lanes.map((lane, index) => [lane.session.id, index]));
        const placed = new Map<string, PlacedBlock>();
        let y = TOP_PADDING;
        for (const block of flow.blocks) {
            const height = heightOf(block);
            placed.set(block.id, { block, x: SIDE_PADDING + (columnOf.get(block.sessionId) ?? 0) * (COLUMN_WIDTH + COLUMN_GAP), y, height });
            y += height + ROW_GAP;
        }
        return { placed, height: y + TOP_PADDING, width: SIDE_PADDING * 2 + flow.lanes.length * COLUMN_WIDTH + (flow.lanes.length - 1) * COLUMN_GAP };
    }, [flow]);

    if (!root || !flow || !layout) {
        return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Escolha uma sessão na lista para ver o fluxo entre os agentes.</p>;
    }

    const text = { fontFamily: CANVAS_FONT, listening: false } as const;
    const columnX = (index: number) => SIDE_PADDING + index * (COLUMN_WIDTH + COLUMN_GAP);
    const openActivity = (sessionId: string) => {
        selectAgent(sessionId);
        setView('activity');
    };

    return (
        <div className="h-full overflow-auto" style={{ background: palette.background }}>
            <div className="sticky top-0 z-10 flex border-b backdrop-blur" style={{ width: layout.width, paddingLeft: SIDE_PADDING, gap: COLUMN_GAP, background: `${palette.background}e6` }}>
                {flow.lanes.map(({ session, depth }) => (
                    <button
                        key={session.id}
                        className="flex shrink-0 items-center gap-2 py-3 text-left"
                        style={{ width: COLUMN_WIDTH }}
                        onClick={() => selectAgent(session.id)}
                        onDoubleClick={() => openActivity(session.id)}
                    >
                        <span className="size-2 shrink-0 rounded-full" style={{ background: palette[session.tool] }} />
                        <span className="min-w-0">
                            <span className={`block truncate text-sm ${session.id === selectedId ? 'font-semibold' : 'font-medium'}`}>{session.role}</span>
                            <span className="block truncate text-xs text-muted-foreground">{depth === 0 ? 'líder da sessão' : (session.nickname ?? 'subagente')}</span>
                        </span>
                    </button>
                ))}
            </div>
            <Stage key={fontsReady ? 'fonts' : 'fallback'} width={layout.width} height={layout.height}>
                <Layer>
                    {flow.lanes.map(({ session }, index) => {
                        const blocks = [...layout.placed.values()].filter((placed) => placed.block.sessionId === session.id);
                        const first = blocks[0];
                        const last = blocks.at(-1);
                        if (!first || !last) {
                            return null;
                        }
                        const x = columnX(index) + COLUMN_WIDTH / 2;
                        return <Line key={`life-${session.id}`} points={[x, first.y, x, last.y + last.height]} stroke={palette.border} strokeWidth={1.5} dash={[4, 6]} listening={false} />;
                    })}
                    {[...layout.placed.values()].map(({ block, x, y, height }) => {
                        const isSelected = block.id === selectedBlockId;
                        const handlers = { onClick: () => select({ type: 'block', sessionId: block.sessionId, block }), onDblClick: () => openActivity(block.sessionId) };
                        if (block.kind === 'work') {
                            const hasFailure = block.items.some((item) => item.ok === false);
                            return (
                                <Group key={block.id} x={x} y={y} {...handlers}>
                                    <Rect width={COLUMN_WIDTH} height={height} cornerRadius={10} fill={palette.card} stroke={isSelected ? palette.borderStrong : palette.border} strokeWidth={isSelected ? 1.5 : 1} />
                                    {hasFailure && <Circle x={COLUMN_WIDTH - 14} y={14} radius={3.5} fill={palette.failed} listening={false} />}
                                    <Text {...text} x={12} y={11} width={COLUMN_WIDTH - 36} text={blockTitle(block, nameOf)} fontSize={13} fill={palette.text} ellipsis wrap="none" />
                                    <Text {...text} x={12} y={34} width={COLUMN_WIDTH - 24} text={blockCounts(block)} fontSize={11} fill={palette.mutedText} ellipsis wrap="none" />
                                    {blockSkills(block) && <Text {...text} x={12} y={52} width={COLUMN_WIDTH - 24} text={blockSkills(block)} fontSize={11} fontStyle="500" fill={palette.skill} ellipsis wrap="none" />}
                                </Group>
                            );
                        }
                        const isWaiting = block.kind === 'waiting';
                        const accent = isWaiting ? palette.waiting : palette.agent;
                        return (
                            <Group key={block.id} x={x} y={y} {...handlers}>
                                <Rect width={COLUMN_WIDTH} height={height} cornerRadius={height / 2} fill={palette.background} />
                                <Rect width={COLUMN_WIDTH} height={height} cornerRadius={height / 2} fill={accent} opacity={isWaiting ? palette.waitingOpacity * 0.6 : 0.14} />
                                <Rect width={COLUMN_WIDTH} height={height} cornerRadius={height / 2} stroke={isSelected ? palette.borderStrong : accent} strokeWidth={isSelected ? 1.5 : 1} opacity={isSelected ? 1 : 0.5} listening={false} />
                                <Text {...text} x={14} y={height / 2 - 7} width={COLUMN_WIDTH - 28} text={blockTitle(block, nameOf)} fontSize={12} fontStyle="500" fill={palette.text} ellipsis wrap="none" />
                            </Group>
                        );
                    })}
                    {flow.edges.map((edge, index) => {
                        const from = layout.placed.get(edge.fromBlock);
                        const to = layout.placed.get(edge.toBlock);
                        if (!from || !to) {
                            return null;
                        }
                        const style = edgeStyle(edge, palette);
                        const goesRight = to.x > from.x;
                        const fromX = goesRight ? from.x + COLUMN_WIDTH : from.x;
                        const toX = goesRight ? to.x : to.x + COLUMN_WIDTH;
                        const fromY = from.y + from.height / 2;
                        const toY = to.y + to.height / 2;
                        const labelX = (fromX + toX) / 2;
                        const labelY = (fromY + toY) / 2;
                        return (
                            <Group key={`edge-${index}`} listening={false}>
                                <Arrow points={[fromX, fromY, toX, toY]} stroke={style.color} fill={style.color} strokeWidth={1.5} dash={style.dash} pointerLength={7} pointerWidth={7} />
                                <Text {...text} x={labelX - 40} y={labelY - 16} width={80} align="center" text={style.label} fontSize={10} fill={style.color} />
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>
        </div>
    );
}
