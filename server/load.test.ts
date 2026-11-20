import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadSessionTree } from './load';
import { treeTokens } from './model';

/** Integration tests use optional local recordings; shared examples must contain only synthetic data. */
const recordings = process.env.SESSIONS_DIR ?? `${process.env.HOME}/.local/share/agent-viewer/recordings`;
const codexLeader = join(recordings, '2025-01-01-codex-demo-mode-issue-42/lider-11111111.jsonl');
const claudeWithSubagents = join(recordings, '2025-01-02-claude-simulacao-subagentes/sessao-33333333.jsonl');
const claudeLong = join(recordings, '2025-01-01-claude-agent-skills-e-testes-example-project/sessao-22222222.jsonl');

describe.skipIf(!existsSync(codexLeader))('codex', () => {
    test('builds the leader with both subagents and the same totals as sessoes.py', async () => {
        const leader = await loadSessionTree(codexLeader);

        expect(leader.tool).toBe('codex');
        expect(leader.children.map((child) => child.role)).toEqual(['demo-julgamento', 'demo-antislop']);
        expect(leader.tokens.total).toBe(17_891_804);
        expect(treeTokens(leader).total).toBe(27_525_137);
        expect(leader.events.filter((event) => event.kind === 'spawn').map((event) => event.childId)).toEqual(leader.children.map((child) => child.id));
    });
});

describe.skipIf(!existsSync(claudeWithSubagents))('claude', () => {
    test('attaches subagents through the meta toolUseId and sums each one from its own transcript', async () => {
        const session = await loadSessionTree(claudeWithSubagents);

        expect(session.tool).toBe('claude');
        expect(session.id).toBe('33333333-3333-4333-8333-333333333333');
        expect(session.children.map((child) => [child.role, child.nickname, child.tokens.total, child.status])).toEqual([
            ['Explore', 'Analisar sessoes.py', 36_648, 'finished'],
            ['Explore', 'Resumir relatorio.json', 47_559, 'finished'],
        ]);
        const spawns = session.events.filter((event) => event.kind === 'spawn');
        expect(spawns.map((event) => event.childId).sort()).toEqual(session.children.map((child) => child.id).sort());
    });

    test.skipIf(!existsSync(claudeLong))('counts one call per message id, not per content line', async () => {
        const session = await loadSessionTree(claudeLong);

        expect(session.calls).toHaveLength(573);
        expect(session.title).toBe('Example session');
    });
});
