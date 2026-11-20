import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildTimeline } from './analysis';
import { loadSessionTree } from './load';

const recordings = process.env.SESSIONS_DIR ?? `${process.env.HOME}/.local/share/agent-viewer/recordings`;
const codexLeader = join(recordings, '2025-01-01-codex-demo-mode-issue-42/lider-11111111.jsonl');

describe.skipIf(!existsSync(codexLeader))('timeline of the issue 42 session', () => {
    test('follows exec cell → wait → write_stdin into one inconclusive Pest run of ~38 min', async () => {
        const [leader] = buildTimeline(await loadSessionTree(codexLeader)).lanes;
        const processes = leader!.segments.filter((segment) => segment.kind === 'process');
        const suite = processes.find((segment) => segment.label.includes('pest --stop-on-failure'));

        expect(suite?.result).toBe('inconclusive');
        expect((suite!.end - suite!.start) / 60_000).toBeCloseTo(38.5, 0);
    });

    test('merges consecutive polls into waiting blocks and counts their model calls', async () => {
        const [leader, judge, antislop] = buildTimeline(await loadSessionTree(codexLeader)).lanes;

        expect(leader!.stats.waitingCalls).toBeGreaterThan(90);
        expect(leader!.stats.waitingMs / 60_000).toBeGreaterThan(45);
        expect(leader!.segments.some((segment) => segment.kind === 'waiting' && segment.label.includes('wait_agent'))).toBe(true);
        expect(judge!.label).toBe('demo-julgamento (Hubble)');
        expect(antislop!.stats.waitingMs).toBe(0);
    });
});
