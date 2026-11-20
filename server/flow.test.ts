import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildFlow } from './flow';
import { loadSessionTree } from './load';

const recordings = process.env.SESSIONS_DIR ?? `${process.env.HOME}/.local/share/agent-viewer/recordings`;
const codexLeader = join(recordings, '2025-01-01-codex-demo-mode-issue-42/lider-11111111.jsonl');
const claudeWithSubagents = join(recordings, '2025-01-02-claude-simulacao-subagentes/sessao-33333333.jsonl');

describe.skipIf(!existsSync(codexLeader))('flow of the issue 42 session', () => {
    test('links delegations, messages both ways and returns', async () => {
        const flow = buildFlow(await loadSessionTree(codexLeader));
        const blockById = new Map(flow.blocks.map((block) => [block.id, block]));
        const count = (kind: string) => flow.edges.filter((edge) => edge.kind === kind).length;
        const leaderId = flow.lanes[0]!.session.id;
        const messages = flow.edges.filter((edge) => edge.kind === 'message');

        expect(flow.lanes.map((lane) => lane.session.role)).toEqual(['líder', 'demo-julgamento', 'demo-antislop']);
        expect(count('spawn')).toBe(2);
        expect(count('return')).toBe(2);
        expect(messages.some((edge) => blockById.get(edge.fromBlock)!.sessionId === leaderId)).toBe(true);
        expect(messages.some((edge) => blockById.get(edge.toBlock)!.sessionId === leaderId)).toBe(true);
        expect(flow.blocks.every((block, index) => index === 0 || flow.blocks[index - 1]!.start <= block.start)).toBe(true);
    });
});

describe.skipIf(!existsSync(claudeWithSubagents))('flow of a Claude session', () => {
    test('links each Agent call to its subagent and back', async () => {
        const flow = buildFlow(await loadSessionTree(claudeWithSubagents));

        expect(flow.edges.filter((edge) => edge.kind === 'spawn')).toHaveLength(2);
        expect(flow.edges.filter((edge) => edge.kind === 'return')).toHaveLength(2);
    });
});
