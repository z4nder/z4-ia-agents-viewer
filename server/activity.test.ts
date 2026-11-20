import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildActivity, summarizeActivity } from './activity';
import { loadSessionTree } from './load';

const recordings = process.env.SESSIONS_DIR ?? `${process.env.HOME}/.local/share/agent-viewer/recordings`;
const codexLeader = join(recordings, '2025-01-01-codex-demo-mode-issue-42/lider-11111111.jsonl');
const claudeWithSubagents = join(recordings, '2025-01-02-claude-simulacao-subagentes/sessao-33333333.jsonl');

describe.skipIf(!existsSync(codexLeader))('activity of the issue 42 session', () => {
    test('merges consecutive polls and keeps commands readable', async () => {
        const leader = await loadSessionTree(codexLeader);
        const activity = buildActivity(leader);
        const waits = activity.filter((item) => item.kind === 'waiting');

        expect(waits.reduce((sum, item) => sum + (item.polls ?? 0), 0)).toBe(leader.events.filter((event) => event.isPoll).length);
        expect(activity.some((item) => item.kind === 'tool' && item.title.includes('pest --stop-on-failure'))).toBe(true);
        expect(activity.filter((item) => item.kind === 'spawn').every((item) => item.childId)).toBe(true);
    });

    test('summarizes what a subagent was asked and what it answered last', async () => {
        const leader = await loadSessionTree(codexLeader);
        const judge = leader.children[0]!;
        const summary = summarizeActivity(judge, leader);

        expect(summary.request).toBeTruthy();
        expect(summary.result).toContain('Implementei a issue 42');
    });
});

describe.skipIf(!existsSync(claudeWithSubagents))('activity of a Claude subagent', () => {
    test('uses the parent Agent description as the request', async () => {
        const session = await loadSessionTree(claudeWithSubagents);
        const child = session.children[0]!;

        expect(summarizeActivity(child, session).request).toBe('Analisar sessoes.py');
    });
});
