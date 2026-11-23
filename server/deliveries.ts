/**
 * What a session produced that lives outside it: pull requests, issues, issue comments and commits.
 * Found in replies, commands and outputs; each one says where it first appeared and which action most
 * likely created it (measured when the output shows it, inferred when only a later reply mentions it).
 */

import { buildActivity, type ActivityItem } from './activity';
import type { Session } from './model';

export type DeliveryKind = 'pr' | 'issue' | 'comment' | 'commit';

export interface DeliveryOrigin {
    itemId: string;
    sessionId: string;
    at: number | null;
    evidence: 'medido' | 'inferido';
}

export interface Delivery {
    kind: DeliveryKind;
    /** owner/repo#123 for GitHub items, the short hash for commits. */
    ref: string;
    url?: string;
    /** Commits: the message and the branch from `[branch hash]`. */
    title?: string;
    branch?: string;
    firstSeen: { itemId: string; sessionId: string; at: number | null };
    origin: DeliveryOrigin | null;
}

const GITHUB_PATTERN = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(pull|issues)\/(\d+)(#issuecomment-\d+)?/g;
const COMMIT_OUTPUT_PATTERN = /\[([\w./-]+) ([0-9a-f]{7,40})\]/;
const COMMIT_MESSAGE_PATTERN = /git commit[^\n]*?-m\s+(?:'([^']*)'|"([^"]*)")/;
/** Actions that can create something outside the session: skill scripts, gh and git. */
const CREATING_COMMAND = /^\s*(gh|git)\s/;
const ORIGIN_WINDOW_MS = 10 * 60_000;

interface Located {
    item: ActivityItem;
    sessionId: string;
}

function flatten(session: Session): Session[] {
    return [session, ...session.children.flatMap(flatten)];
}

function isCreatingAction(item: ActivityItem): boolean {
    return item.kind === 'tool' && (Boolean(item.tags?.skills?.some((tag) => tag.use === 'script')) || CREATING_COMMAND.test(item.detail ?? ''));
}

/** The last action of the same agent before `time` that could have created it. */
function inferOrigin(items: Located[], sessionId: string, time: number | null): DeliveryOrigin | null {
    if (time === null) {
        return null;
    }
    const action = items.findLast(({ item, sessionId: owner }) => owner === sessionId && item.at !== null && item.at <= time && time - item.at <= ORIGIN_WINDOW_MS && isCreatingAction(item));
    return action ? { itemId: action.item.id, sessionId, at: action.item.at, evidence: 'inferido' } : null;
}

export function buildDeliveries(root: Session): Delivery[] {
    const items: Located[] = flatten(root)
        .flatMap((session) => buildActivity(session).map((item) => ({ item, sessionId: session.id })))
        .sort((a, b) => (a.item.at ?? 0) - (b.item.at ?? 0));
    const deliveries = new Map<string, Delivery>();

    for (const located of items) {
        const { item, sessionId } = located;
        const firstSeen = { itemId: item.id, sessionId, at: item.at };
        const inOutput = item.kind === 'tool' ? (item.output ?? '') : '';
        const inText = item.kind === 'reply' || item.kind === 'prompt' ? (item.detail ?? '') : '';

        for (const [source, isOutput] of [
            [inOutput, true],
            [inText, false],
        ] as const) {
            for (const match of source.matchAll(GITHUB_PATTERN)) {
                const [url, repo, type, number, comment] = match;
                const kind: DeliveryKind = type === 'pull' ? 'pr' : comment ? 'comment' : 'issue';
                const ref = `${repo}#${number}`;
                const key = `${kind}:${ref}:${comment ?? ''}`;
                if (deliveries.has(key)) {
                    continue;
                }
                // An issue the agent only mentions was not created by it; PRs and comments get an origin.
                const origin: DeliveryOrigin | null =
                    kind === 'issue' ? null : isOutput ? { itemId: item.id, sessionId, at: item.at, evidence: 'medido' } : inferOrigin(items, sessionId, item.at);
                deliveries.set(key, { kind, ref, url, firstSeen, origin });
            }
        }

        const commit = item.kind === 'tool' && item.ok !== false && /git commit/.test(item.detail ?? '') ? inOutput.match(COMMIT_OUTPUT_PATTERN) : null;
        if (commit && !deliveries.has(`commit:${commit[2]}`)) {
            const message = item.detail?.match(COMMIT_MESSAGE_PATTERN);
            deliveries.set(`commit:${commit[2]}`, {
                kind: 'commit',
                ref: commit[2]!,
                branch: commit[1],
                title: message?.[1] ?? message?.[2],
                firstSeen,
                origin: { itemId: item.id, sessionId, at: item.at, evidence: 'medido' },
            });
        }
    }
    return [...deliveries.values()];
}
