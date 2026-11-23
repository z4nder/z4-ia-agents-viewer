import { afterEach, expect, test } from 'bun:test';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { listSessions } from './discover';
import { readSessionMetrics } from './sessionMetrics';

const folders: string[] = [];
afterEach(async () => {
    await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

async function folder() {
    const dir = await mkdtemp(join(tmpdir(), 'session-summary-'));
    folders.push(dir);
    return dir;
}

async function log(file: string, entries: unknown[]) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
}

const at = (minute: number) => `2025-01-01T10:${String(minute).padStart(2, '0')}:00Z`;
const meta = (id: string, parentId?: string) => ({ type: 'session_meta', timestamp: at(0), payload: { id, parent_thread_id: parentId } });
const usage = (minute: number, input = 100, output = 20) => ({ type: 'token_usage_record', timestamp: at(minute), payload: { usage: { input_tokens: input, cached_input_tokens: 50, output_tokens: output } } });
const model = (name: string) => ({ type: 'turn_context', timestamp: at(0), payload: { model: name } });

test('discovery totals nested Codex agents, model switches and child updates across directories', async () => {
    const dir = await folder();
    await log(join(dir, 'first/leader.jsonl'), [meta('leader'), model('model-a'), model('model-b'), usage(10)]);
    await log(join(dir, 'second/child.jsonl'), [meta('child', 'leader'), model('model-b'), usage(20)]);
    const grandchild = join(dir, 'third/grandchild.jsonl');
    await log(grandchild, [meta('grandchild', 'child'), model('model-c'), usage(30)]);
    const roots = [{ source: 'gravada' as const, dir, pattern: '**/*.jsonl' }];
    const sessions = await listSessions(roots);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ agentCount: 3, callCount: 3, totalTokens: 360, durationMs: 30 * 60_000, models: ['model-a', 'model-b', 'model-c'] });

    await appendFile(grandchild, JSON.stringify(usage(40, 3, 2)) + '\n');
    const refreshed = await listSessions(roots);
    expect(refreshed[0]).toMatchObject({ agentCount: 3, callCount: 4, totalTokens: 365, durationMs: 40 * 60_000 });
});

test('Claude summaries include subagents and deduplicate message usage', async () => {
    const dir = await folder();
    const file = join(dir, 'project/session.jsonl');
    const assistant = { type: 'assistant', sessionId: 'example', timestamp: at(5), message: { id: 'message-a', model: 'model-a', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 10 } } };
    await log(file, [{ type: 'user', sessionId: 'example', timestamp: at(0), message: { content: 'Example session' } }, assistant, assistant]);
    await log(join(dir, 'project/session/subagents/agent-example.jsonl'), [{ ...assistant, timestamp: at(10), message: { id: 'message-b', model: 'model-b', usage: { input_tokens: 20, output_tokens: 10 } } }]);
    const sessions = await listSessions([{ source: 'claude', dir, pattern: '*/*.jsonl' }]);
    expect(sessions[0]).toMatchObject({ agentCount: 2, callCount: 2, totalTokens: 190, durationMs: 10 * 60_000, models: ['model-a', 'model-b'] });
});

test('modern Codex usage ignores repeated cumulative events and partial lines', async () => {
    const dir = await folder();
    const file = join(dir, 'modern.jsonl');
    const event = { type: 'event_msg', timestamp: at(1), payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, output_tokens: 20 }, total_token_usage: { input_tokens: 100, output_tokens: 20 } } } };
    await log(file, [meta('example'), model('model-a'), event, event]);
    await appendFile(file, '{"type":');
    expect(await readSessionMetrics(file, 'codex')).toMatchObject({ callCount: 1, totalTokens: 120, models: ['model-a'] });

    await log(file, [meta('example'), event, usage(2)]);
    expect(await readSessionMetrics(file, 'codex')).toMatchObject({ callCount: 1, totalTokens: 120 });
});

test('missing timestamps and usage remain unknown duration and zero calls', async () => {
    const dir = await folder();
    const file = join(dir, 'empty.jsonl');
    await log(file, [{ type: 'session_meta', payload: { id: 'example' } }]);
    expect(await readSessionMetrics(file, 'codex')).toEqual({ callCount: 0, totalTokens: 0, start: null, end: null, models: [] });
});
