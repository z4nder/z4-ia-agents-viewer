/**
 * Sequence view across agents: each agent is a column, its activity is split into blocks, and edges
 * show a delegation, each message (sender's send → receiver's receipt) and the return when a subagent ends.
 * Blocks are ordered by time across all agents, so reading top to bottom follows the session.
 */

import { buildActivity, type ActivityItem } from './activity';
import type { Session } from './model';

export type FlowBlockKind = 'work' | 'waiting' | 'spawn' | 'send' | 'receive';

export interface FlowBlock {
    id: string;
    sessionId: string;
    kind: FlowBlockKind;
    start: number;
    end: number;
    items: ActivityItem[];
}

export type FlowEdgeKind = 'spawn' | 'message' | 'return';

export interface FlowEdge {
    kind: FlowEdgeKind;
    fromBlock: string;
    toBlock: string;
}

export interface FlowLane {
    session: Session;
    depth: number;
}

export interface Flow {
    lanes: FlowLane[];
    /** All blocks, in time order. */
    blocks: FlowBlock[];
    edges: FlowEdge[];
}

/** How far apart a send and its receipt can be and still be paired. */
const MESSAGE_PAIR_MS = 60_000;

function blockKind(item: ActivityItem): FlowBlockKind | null {
    switch (item.tags?.agent?.direction) {
        case 'delegated':
            return 'spawn';
        case 'sent':
            return 'send';
        case 'received':
            return 'receive';
    }
    return item.kind === 'waiting' ? 'waiting' : null;
}

/** Agent-to-agent items and waits become blocks of their own; everything between them is one work block. */
function splitIntoBlocks(session: Session): FlowBlock[] {
    const blocks: FlowBlock[] = [];
    let work: FlowBlock | null = null;
    for (const item of buildActivity(session)) {
        if (item.kind === 'context' || item.at === null) {
            continue;
        }
        const end = item.at + (item.seconds ?? 0) * 1000;
        const kind = blockKind(item);
        if (kind) {
            work = null;
            blocks.push({ id: item.id, sessionId: session.id, kind, start: item.at, end, items: [item] });
            continue;
        }
        if (!work) {
            work = { id: item.id, sessionId: session.id, kind: 'work', start: item.at, end, items: [] };
            blocks.push(work);
        }
        work.items.push(item);
        work.end = Math.max(work.end, end);
    }
    return blocks;
}

function flatten(session: Session, depth = 0): FlowLane[] {
    return [{ session, depth }, ...session.children.flatMap((child) => flatten(child, depth + 1))];
}

/** Codex names a peer by address (/root/implementar) or last segment (implementar). */
function matchesPeer(session: Session, peer: string | null | undefined): boolean {
    if (!peer) {
        return false;
    }
    return session.agentPath === peer || session.agentPath?.split('/').at(-1) === peer || session.id === peer || session.role === peer;
}

export function buildFlow(root: Session): Flow {
    const lanes = flatten(root);
    const blocksBySession = new Map(lanes.map(({ session }) => [session.id, splitIntoBlocks(session)]));
    const edges: FlowEdge[] = [];
    const firstBlockAfter = (sessionId: string, time: number) => blocksBySession.get(sessionId)?.find((block) => block.start >= time);

    for (const { session } of lanes) {
        const blocks = blocksBySession.get(session.id) ?? [];
        for (const block of blocks) {
            const item = block.items[0]!;
            if (block.kind === 'spawn' && item.childId) {
                const childFirst = blocksBySession.get(item.childId)?.[0];
                if (childFirst) {
                    edges.push({ kind: 'spawn', fromBlock: block.id, toBlock: childFirst.id });
                }
            }
            if (block.kind === 'receive') {
                // Pair the receipt with the sender's latest send to this agent just before it.
                const sender = lanes.find((lane) => matchesPeer(lane.session, item.tags?.agent?.peer))?.session;
                const send = sender
                    ? (blocksBySession.get(sender.id) ?? []).findLast(
                          (candidate) => candidate.kind === 'send' && candidate.start <= block.start + 2_000 && block.start - candidate.start <= MESSAGE_PAIR_MS && matchesPeer(session, candidate.items[0]!.tags?.agent?.peer),
                      )
                    : undefined;
                if (send) {
                    edges.push({ kind: 'message', fromBlock: send.id, toBlock: block.id });
                }
            }
        }
        // A subagent's end hands control back to its parent.
        const last = blocks.at(-1);
        if (session.parentId && last) {
            const back = firstBlockAfter(session.parentId, last.end);
            if (back) {
                edges.push({ kind: 'return', fromBlock: last.id, toBlock: back.id });
            }
        }
    }

    const blocks = [...blocksBySession.values()].flat().sort((a, b) => a.start - b.start);
    return { lanes, blocks, edges };
}
