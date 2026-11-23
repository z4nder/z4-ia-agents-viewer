import { buildActivity } from '../../../../server/activity';
import { buildLane } from '../../../../server/analysis';
import type { Segment } from '../../../../server/analysis';
import { buildFlow } from '../../../../server/flow';
import type { Session } from '../../../../server/model';
import { groupSkillReading } from '../../../../server/skills';
import type { Selection, SessionView } from './sessionStore';

const STORAGE_KEY = 'z4-viewer-session-navigation';
export const SESSION_VIEWS: SessionView[] = ['tree', 'timeline', 'flow', 'activity'];

export type SelectionReference =
    | { type: 'agent'; sessionId: string }
    | { type: 'item'; sessionId: string; itemId: string }
    | { type: 'block'; sessionId: string; blockId: string }
    | { type: 'segment'; sessionId: string; kind: string; start: number; labelHash?: string };

export interface SessionNavigation {
    file: string | null;
    view: SessionView;
    selection: SelectionReference | null;
}

function segmentLabelHash(segment: Segment): string {
    let hash = 2166136261;
    for (const character of segment.label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16);
}

export function selectionReference(selection: Selection | null): SelectionReference | null {
    if (!selection) return null;
    const { sessionId } = selection;
    if (selection.type === 'item') return { type: 'item', sessionId, itemId: selection.item.id };
    if (selection.type === 'block') return { type: 'block', sessionId, blockId: selection.block.id };
    if (selection.type === 'segment') return { type: 'segment', sessionId, kind: selection.segment.kind, start: selection.segment.start, labelHash: segmentLabelHash(selection.segment) };
    return { type: 'agent', sessionId };
}

export function readSessionNavigation(storage?: Pick<Storage, 'getItem'>): SessionNavigation {
    const defaults: SessionNavigation = { file: null, view: 'tree', selection: null };
    try {
        const saved = JSON.parse((storage ?? localStorage).getItem(STORAGE_KEY) ?? '{}');
        if (!saved || saved.version !== 1) return defaults;
        const reference = saved.selection;
        let selection: SelectionReference | null = null;
        if (reference && typeof reference.sessionId === 'string') {
            const sessionId = reference.sessionId;
            if (reference.type === 'agent') selection = { type: 'agent', sessionId };
            if (reference.type === 'item' && typeof reference.itemId === 'string') selection = { type: 'item', sessionId, itemId: reference.itemId };
            if (reference.type === 'block' && typeof reference.blockId === 'string') selection = { type: 'block', sessionId, blockId: reference.blockId };
            if (reference.type === 'segment' && ['tool', 'process', 'waiting'].includes(reference.kind) && Number.isFinite(reference.start)) {
                selection = { type: 'segment', sessionId, kind: reference.kind, start: reference.start,
                    ...(typeof reference.labelHash === 'string' ? { labelHash: reference.labelHash } : {}) };
            }
        }
        return {
            file: typeof saved.file === 'string' && saved.file ? saved.file : null,
            view: SESSION_VIEWS.includes(saved.view) ? saved.view : 'tree', selection,
        };
    } catch {
        return defaults;
    }
}

export function saveSessionNavigation(navigation: SessionNavigation, storage?: Pick<Storage, 'setItem'>): void {
    try {
        (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...navigation }));
    } catch {
        // Restoring is optional when the browser blocks storage.
    }
}

function findAgent(root: Session, id: string): Session | undefined {
    if (root.id === id) return root;
    for (const child of root.children) {
        const match = findAgent(child, id);
        if (match) return match;
    }
}

/** Rebuild details from the current log; no commands, outputs or message contents are stored. */
export function restoreSelection(root: Session, reference: SelectionReference | null): Selection {
    const session = reference ? findAgent(root, reference.sessionId) : root;
    if (!session) return { type: 'agent', sessionId: root.id };
    const sessionId = session.id;
    if (reference?.type === 'item') {
        const items = buildActivity(session);
        const item = [...groupSkillReading(items), ...items].find((item) => item.id === reference.itemId);
        if (item) return { type: 'item', sessionId, item };
    } else if (reference?.type === 'block') {
        const block = buildFlow(root).blocks.find((block) => block.sessionId === sessionId && block.id === reference.blockId);
        if (block) return { type: 'block', sessionId, block };
    } else if (reference?.type === 'segment') {
        const segment = buildLane(session, 0).segments.find((segment) => segment.kind === reference.kind && segment.start === reference.start && (!reference.labelHash || segmentLabelHash(segment) === reference.labelHash));
        if (segment) return { type: 'segment', sessionId, segment };
    }
    return { type: 'agent', sessionId };
}
