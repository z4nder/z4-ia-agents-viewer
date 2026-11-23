/**
 * What an agent did, in order: prompts, replies, commands with their output, delegations and waits.
 * Consecutive polls collapse into one "waiting" item. Pure functions shared with the web.
 */

import { tagEvent, type EventTags } from './classify';
import type { Session, SessionEvent } from './model';

export type ActivityKind = 'prompt' | 'context' | 'reply' | 'tool' | 'spawn' | 'waiting' | 'message' | 'skills';

export interface ActivityItem {
    id: string;
    kind: ActivityKind;
    at: number | null;
    title: string;
    /** Full text shown when the item is expanded: the message, command or output. */
    detail?: string;
    output?: string;
    ok?: boolean | null;
    seconds?: number;
    /** spawn: the child session it created. waiting: how many polls were merged. */
    childId?: string;
    polls?: number;
    tags?: EventTags;
    /** waiting: at least one of the merged polls waited for another agent. */
    waitsForAgent?: boolean;
    /** message: Codex message type (NEW_TASK, MESSAGE…). */
    messageType?: string;
    /** skills: the skill loads and reads collapsed into this item. */
    children?: ActivityItem[];
}

const WAIT_FOR_AGENT = new Set(['wait_agent', 'TaskOutput']);

export interface ActivitySummary {
    /** What the agent was asked: the user prompt for the leader, the parent's task for a subagent. */
    request: string | null;
    /** Its first reply, which usually states the plan. */
    plan: string | null;
    /** Its last reply. */
    result: string | null;
}

function firstLine(text: string, max = 160): string {
    const line = text.trim().split('\n').find((candidate) => candidate.trim()) ?? '';
    return line.length > max ? `${line.slice(0, max)}…` : line;
}

const PATCH_FILE_PATTERN = /\*\*\* (Update|Add|Delete) File: ([^\n\\]+)/g;
const PATCH_VERBS: Record<string, string> = { Update: 'editou', Add: 'criou', Delete: 'apagou' };

/** apply_patch carries the whole diff: name the files it touched instead. */
function patchTitle(patch: string): string | null {
    const files = [...patch.matchAll(PATCH_FILE_PATTERN)].map((match) => `${PATCH_VERBS[match[1]!]} ${match[2]!.trim().split('/').at(-1)}`);
    return files.length ? files.join(', ') : null;
}

function toolTitle(event: SessionEvent): string {
    const commands = event.commands ?? [];
    const patch = commands[0]?.includes('*** Begin Patch') ? patchTitle(commands[0]) : null;
    if (patch) {
        return `Patch: ${patch}`;
    }
    if (event.name === 'Skill') {
        return `Skill ${commands[0] ?? '?'}`;
    }
    const command = commands[0];
    if (command && !command.startsWith('const ')) {
        const more = commands.length > 1 ? `  +${commands.length - 1} comandos` : '';
        return `${firstLine(command, 140)}${more}`;
    }
    return event.text ? `${event.name} ${event.text}` : (event.name ?? '?');
}

function parse(at: string | null): number | null {
    return at ? Date.parse(at) : null;
}

export function buildActivity(session: Session): ActivityItem[] {
    const items: ActivityItem[] = [];
    let waiting: ActivityItem | null = null;

    session.events.forEach((event, index) => {
        const id = `${session.id}-${index}`;
        const at = parse(event.at);
        if (event.isPoll) {
            const end = (at ?? 0) + (event.seconds ?? 0) * 1000;
            if (waiting) {
                waiting.polls = (waiting.polls ?? 1) + 1;
                waiting.seconds = Math.round((end - (waiting.at ?? end)) / 1000);
                if (event.name && WAIT_FOR_AGENT.has(event.name)) {
                    waiting.waitsForAgent = true;
                }
                if (event.name && !waiting.detail?.includes(event.name)) {
                    waiting.detail = `${waiting.detail}, ${event.name}`;
                }
            } else {
                waiting = { id, kind: 'waiting', at, title: 'Esperando', detail: event.name ?? '', polls: 1, seconds: event.seconds ?? 0 };
                if (event.name && WAIT_FOR_AGENT.has(event.name)) {
                    waiting.waitsForAgent = true;
                }
                items.push(waiting);
            }
            return;
        }
        if (event.kind === 'tool' || event.kind === 'action' || event.kind === 'spawn') {
            waiting = null;
        }

        switch (event.kind) {
            case 'user':
                items.push({ id, kind: 'prompt', at, title: firstLine(event.text ?? ''), detail: event.text });
                break;
            case 'context': {
                const tags = tagEvent(event);
                const title = tags.skill ? `Carregou a skill ${tags.skill.name}` : firstLine(event.text ?? '', 90);
                items.push({ id, kind: 'context', at, title, detail: event.text, tags });
                break;
            }
            case 'reply':
                items.push({ id, kind: 'reply', at, title: firstLine(event.text ?? '', 220), detail: event.text });
                break;
            case 'tool':
            case 'action':
                items.push({ id, kind: 'tool', at, title: toolTitle(event), detail: event.commands?.join('\n\n') ?? event.text, output: event.output, ok: event.ok, seconds: event.seconds, tags: tagEvent(event) });
                break;
            case 'spawn':
                items.push({ id, kind: 'spawn', at, title: `Delegou para ${event.agent ?? 'um subagente'}`, detail: event.task, output: event.text, childId: event.childId, ok: event.ok, tags: tagEvent(event) });
                break;
            case 'agent-message':
                items.push({ id, kind: 'message', at, title: `Mensagem de ${event.from ?? '?'} para ${event.to ?? '?'}`, detail: event.text, messageType: event.messageType, tags: tagEvent(event) });
                break;
        }
    });
    return items;
}

function findSpawnOf(root: Session, childId: string): SessionEvent | null {
    for (const event of root.events) {
        if (event.kind === 'spawn' && event.childId === childId) {
            return event;
        }
    }
    for (const child of root.children) {
        const found = findSpawnOf(child, childId);
        if (found) {
            return found;
        }
    }
    return null;
}

export function summarizeActivity(session: Session, root: Session): ActivitySummary {
    const spawn = session.parentId ? findSpawnOf(root, session.id) : null;
    const prompt = session.events.find((event) => event.kind === 'user')?.text ?? null;
    const replies = session.events.filter((event) => event.kind === 'reply');
    return {
        request: spawn?.task ?? session.nickname ?? prompt,
        plan: replies.length > 1 ? (replies[0]?.text ?? null) : null,
        result: replies.at(-1)?.text ?? null,
    };
}
