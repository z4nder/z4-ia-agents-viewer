/**
 * What agents asked each other and what came back. Codex encrypts the payload of messages, so besides the
 * readable parts (Claude's spawn prompt, the Codex message type) this uses what each agent said right
 * before sending and right after receiving; those are labeled as inferred.
 */

import type { Flow, FlowBlock, FlowEdgeKind } from './flow';
import type { Session, SessionEvent } from './model';

export interface Said {
    text: string;
    at: number;
    /** `mensagem`: the message itself was readable. `inferido`: what the agent said around it. */
    evidence: 'mensagem' | 'inferido';
}

export interface Exchange {
    kind: FlowEdgeKind;
    fromSessionId: string;
    toSessionId: string;
    at: number;
    messageType?: string;
    /** What the sender asked or said before sending. */
    request: Said | null;
    /** What the receiver said right after it arrived. */
    reaction: Said | null;
    /** For a delegation or a return: the subagent's last reply, i.e. what it handed back. */
    delivered: Said | null;
}

/** How far around a message we look for what the agents said. */
const NEARBY_MS = 10 * 60_000;

function replies(session: Session): { at: number; text: string }[] {
    return session.events
        .filter((event: SessionEvent) => event.kind === 'reply' && event.at && event.text)
        .map((event) => ({ at: Date.parse(event.at!), text: event.text! }));
}

function replyBefore(session: Session, time: number): Said | null {
    const reply = replies(session).findLast((candidate) => candidate.at <= time && time - candidate.at <= NEARBY_MS);
    return reply ? { ...reply, evidence: 'inferido' } : null;
}

function replyAfter(session: Session, time: number): Said | null {
    const reply = replies(session).find((candidate) => candidate.at >= time && candidate.at - time <= NEARBY_MS);
    return reply ? { ...reply, evidence: 'inferido' } : null;
}

function lastReply(session: Session): Said | null {
    const reply = replies(session).at(-1);
    return reply ? { ...reply, evidence: 'inferido' } : null;
}

function find(root: Session, id: string): Session | null {
    if (root.id === id) {
        return root;
    }
    for (const child of root.children) {
        const found = find(child, id);
        if (found) {
            return found;
        }
    }
    return null;
}

/** One exchange per arrow of the flow, keyed by both of its blocks. */
export function buildExchanges(root: Session, flow: Flow): Map<string, Exchange[]> {
    const blockById = new Map(flow.blocks.map((block) => [block.id, block]));
    const byBlock = new Map<string, Exchange[]>();
    const add = (block: FlowBlock, exchange: Exchange) => byBlock.set(block.id, [...(byBlock.get(block.id) ?? []), exchange]);

    for (const edge of flow.edges) {
        const from = blockById.get(edge.fromBlock);
        const to = blockById.get(edge.toBlock);
        const sender = from && find(root, from.sessionId);
        const receiver = to && find(root, to.sessionId);
        if (!from || !to || !sender || !receiver) {
            continue;
        }
        const sent = from.items[0]!;
        const prompt = edge.kind === 'spawn' && sent.output ? ({ text: sent.output, at: from.start, evidence: 'mensagem' } as Said) : null;
        const exchange: Exchange = {
            kind: edge.kind,
            fromSessionId: sender.id,
            toSessionId: receiver.id,
            at: from.start,
            // The NEW_TASK message reaches the subagent a moment after its first block.
            messageType: edge.kind === 'spawn' ? receiver.events.find((event) => event.messageType)?.messageType : to.items[0]?.messageType,
            request: edge.kind === 'return' ? null : (prompt ?? replyBefore(sender, from.start)),
            reaction: replyAfter(receiver, to.start),
            delivered: edge.kind === 'spawn' ? lastReply(receiver) : edge.kind === 'return' ? lastReply(sender) : null,
        };
        add(from, exchange);
        add(to, exchange);
    }
    return byBlock;
}
