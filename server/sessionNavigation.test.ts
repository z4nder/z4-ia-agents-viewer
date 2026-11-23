import { expect, test } from 'bun:test';
import { buildActivity } from './activity';
import { buildLane } from './analysis';
import { buildFlow } from './flow';
import { newSession } from './model';
import { groupSkillReading } from './skills';
import { readSessionNavigation, restoreSelection, saveSessionNavigation, selectionReference } from '../src/features/session-tree/store/sessionNavigation';
import { clampDetailsWidth } from '../src/features/workspace/store/workspaceStore';

function example() {
    const at = '2025-01-01T10:00:00Z';
    const root = newSession({ id: 'leader', file: '/example/session.jsonl', tool: 'codex', startedAt: at, endedAt: at });
    const child = newSession({ id: 'child', file: '/example/child.jsonl', tool: 'codex', parentId: root.id, startedAt: at, endedAt: at, events: [
        { at, kind: 'user', text: 'Example task' },
        { at, kind: 'tool', name: 'exec_command', commands: ['cat /example/skills/demo-mode/SKILL.md'], output: 'Example instructions' },
        { at, kind: 'tool', name: 'exec_command', commands: ['cat /example/skills/demo-mode/playbooks/feature.md'], output: 'Example playbook' },
        { at, kind: 'tool', name: 'exec_command', commands: ['node --version'], output: 'Example output', seconds: 2 },
    ] });
    root.children.push(child);
    return { root, child };
}

test('restores agents, grouped activity, flow blocks and timeline segments from compact references', () => {
    const { root, child } = example();
    const item = groupSkillReading(buildActivity(child)).find((item) => item.kind === 'skills')!;
    const block = buildFlow(root).blocks.find((block) => block.sessionId === child.id)!;
    const segment = buildLane(child, 0).segments.find((segment) => segment.kind === 'tool')!;
    const selections = [
        { type: 'agent' as const, sessionId: child.id },
        { type: 'item' as const, sessionId: child.id, item },
        { type: 'block' as const, sessionId: child.id, block },
        { type: 'segment' as const, sessionId: child.id, segment },
    ];
    for (const selection of selections) {
        expect(restoreSelection(root, selectionReference(selection))).toEqual(selection);
    }
    expect(JSON.stringify(selections.map(selectionReference))).not.toContain('Example instructions');
});

test('missing items fall back to their agent and missing agents fall back to the leader', () => {
    const { root, child } = example();
    expect(restoreSelection(root, { type: 'item', sessionId: child.id, itemId: 'removed' })).toEqual({ type: 'agent', sessionId: child.id });
    expect(restoreSelection(root, { type: 'agent', sessionId: 'removed' })).toEqual({ type: 'agent', sessionId: root.id });
});

test('restores navigation without saving session contents and tolerates unavailable or corrupt storage', () => {
    const { root, child } = example();
    let saved = '';
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const navigation = { file: root.file, view: 'activity' as const, selection: { type: 'item' as const, sessionId: child.id, itemId: 'child-3' } };
    saveSessionNavigation(navigation, storage);
    expect(readSessionNavigation(storage)).toEqual(navigation);
    expect(saved).not.toContain('Example output');
    for (const raw of ['{broken', 'null', '[]', '{"version":99}']) {
        saved = raw;
        expect(readSessionNavigation(storage)).toEqual({ file: null, view: 'tree', selection: null });
    }
    expect(() => saveSessionNavigation(navigation, { setItem: () => { throw new Error('Storage blocked'); } })).not.toThrow();
});

test('details width respects desktop limits and a smaller available workspace', () => {
    expect(clampDetailsWidth(100)).toBe(280);
    expect(clampDetailsWidth(900)).toBe(640);
    expect(clampDetailsWidth(500, 400)).toBe(400);
});
