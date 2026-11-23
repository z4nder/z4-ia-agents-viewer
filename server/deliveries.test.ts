import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildActivity } from './activity';
import { buildExchanges } from './conversation';
import { buildDeliveries } from './deliveries';
import { buildFlow } from './flow';
import { loadSessionTree } from './load';
import { buildSkillUsage, groupSkillReading } from './skills';

const recordings = process.env.SESSIONS_DIR ?? `${process.env.HOME}/.local/share/agent-viewer/recordings`;
const codexLeader = join(recordings, '2025-01-01-codex-demo-mode-issue-42/lider-11111111.jsonl');

describe.skipIf(!existsSync(codexLeader))('skills, deliveries and exchanges of the issue 42 session', () => {
    test('groups skill usage by file read and script subcommand, with failures', async () => {
        const leader = await loadSessionTree(codexLeader);
        const usage = new Map(buildSkillUsage(buildActivity(leader)).map((skill) => [skill.name, skill]));
        const pr = usage.get('demo-pr')!.scripts.map((script) => `${script.subcommand}:${script.runs}:${script.failures}`);

        expect(usage.get('demo-mode')!.loads).toHaveLength(1);
        expect(usage.get('demo-mode')!.docs.map((doc) => doc.path)).toContain('playbooks/feature.md');
        expect(pr).toContain('branch:2:1');
        expect(pr).toContain('abrir:2:1');
    });

    test('collapses consecutive skill reading but keeps scripts as rows', async () => {
        const leader = await loadSessionTree(codexLeader);
        const grouped = groupSkillReading(buildActivity(leader));
        const group = grouped.find((item) => item.kind === 'skills')!;

        expect(group.children!.length).toBeGreaterThan(1);
        expect(group.children!.every((child) => !child.tags?.skills?.some((tag) => tag.use === 'script'))).toBe(true);
        expect(grouped.some((item) => item.kind === 'tool' && item.tags?.skill?.resource?.subcommand === 'abrir')).toBe(true);
    });

    test('finds the PR, the issue comment and the commit with their origin', async () => {
        const deliveries = buildDeliveries(await loadSessionTree(codexLeader));
        const byKind = (kind: string) => deliveries.filter((delivery) => delivery.kind === kind);

        expect(byKind('pr').map((delivery) => [delivery.ref, delivery.origin?.evidence])).toEqual([['example-org/example-project#123', 'inferido']]);
        expect(byKind('comment')[0]?.origin?.evidence).toBe('medido');
        expect(byKind('commit')[0]).toMatchObject({ ref: 'abc123def', branch: 'example-42-sample-feature' });
    });

    test('pairs each delegation with what the subagent handed back', async () => {
        const root = await loadSessionTree(codexLeader);
        const flow = buildFlow(root);
        const exchanges = [...buildExchanges(root, flow).values()].flat();
        const spawn = exchanges.find((exchange) => exchange.kind === 'spawn' && exchange.toSessionId === root.children[0]!.id)!;

        expect(spawn.messageType).toBe('NEW_TASK');
        expect(spawn.delivered?.text).toContain('Implementei a issue 42');
        expect(spawn.request?.evidence).toBe('inferido');
    });
});
