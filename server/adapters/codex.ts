/**
 * Codex adapter (personal and work): ~/.codex{,-empresa}/sessions/YYYY/MM/DD/rollout-*.jsonl, one session per file.
 * A subagent points to its parent at session_meta.payload.source.subagent.thread_spawn.parent_thread_id.
 * Ported from a standalone session parser.
 */

import { Glob } from 'bun';
import { basename, dirname } from 'node:path';
import { readJsonl } from '../jsonl';
import { finishSession, newSession, trackTimestamp, type Session, type SessionEvent, type Tokens } from '../model';

const COMMAND_PATTERN = /cmd\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const FAILURE_PATTERN = /(Script failed|exit code[: ]+[1-9]|Process exited with code [1-9]|\berror:|Traceback)/i;

function textOf(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .filter((block) => ['input_text', 'output_text', 'text'].includes(block?.type))
        .map((block) => block.text ?? '')
        .join('\n');
}

function unescapeJsString(value: string): string {
    try {
        return JSON.parse(`"${value}"`);
    } catch {
        return value;
    }
}

function spawnInfo(meta: any): any {
    return meta?.source && typeof meta.source === 'object' ? (meta.source.subagent?.thread_spawn ?? {}) : {};
}

/** Codex `input_tokens` already includes the cache, and reasoning is already inside `output_tokens`. */
function normalizeUsage(usage: any): Tokens {
    const input = usage.input_tokens ?? 0;
    const cached = usage.cached_input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    return {
        input: input - cached,
        cacheRead: cached,
        cacheWrite: 0,
        output,
        reasoning: usage.reasoning_output_tokens ?? 0,
        total: input + output,
    };
}

function summarizeArgs(args: Record<string, unknown>): string {
    return Object.entries(args)
        .filter(([key, value]) => key !== 'message' && ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
}

export function isCodexLine(firstLine: any): boolean {
    return firstLine?.type === 'session_meta';
}

/** Reads only the session_meta (first line) without loading the whole file. */
export async function readCodexMeta(file: string): Promise<any | null> {
    const head = await Bun.file(file).slice(0, 256 * 1024).text();
    for (const line of head.split('\n')) {
        try {
            const entry = JSON.parse(line);
            if (entry.type === 'session_meta') {
                return entry.payload;
            }
        } catch {
            // Not JSON or cut at the slice boundary.
        }
    }
    return null;
}

export async function loadCodexSession(file: string): Promise<Session> {
    const lines = await readJsonl(file);
    const meta = lines.find((entry) => entry.type === 'session_meta')?.payload ?? {};
    const spawn = spawnInfo(meta);
    const session = newSession({
        id: meta.id ?? basename(file, '.jsonl'),
        tool: 'codex',
        file,
        parentId: meta.parent_thread_id ?? spawn.parent_thread_id ?? null,
        role: meta.agent_role ?? spawn.agent_role ?? 'líder',
        nickname: meta.agent_nickname ?? spawn.agent_nickname ?? null,
        cwd: meta.cwd ?? null,
    });
    const pendingCalls = new Map<string, SessionEvent>();

    for (const entry of lines) {
        const payload = entry.payload ?? {};
        const at: string | null = entry.timestamp ?? null;
        trackTimestamp(session, at);

        if (entry.type === 'turn_context') {
            session.model = payload.model ?? session.model;
            session.effort = payload.effort ?? payload.reasoning_effort ?? session.effort;
        } else if (entry.type === 'token_usage_record') {
            session.calls.push({ at, tokens: normalizeUsage(payload.usage ?? {}) });
        } else if (entry.type === 'response_item') {
            handleResponseItem(session, pendingCalls, payload, at);
        }
    }

    return finishSession(session);
}

function handleResponseItem(session: Session, pendingCalls: Map<string, SessionEvent>, payload: any, at: string | null): void {
    switch (payload.type) {
        case 'message': {
            const text = textOf(payload.content).trim();
            if (!text) {
                return;
            }
            if (payload.role === 'user') {
                const isInjected = text.startsWith('<') || text.startsWith('# AGENTS.md');
                session.events.push({ at, kind: isInjected ? 'context' : 'user', text });
            } else if (payload.role === 'assistant') {
                session.events.push({ at, kind: 'reply', text });
            }
            return;
        }
        case 'custom_tool_call': {
            const input: string = payload.input ?? '';
            const commands = [...input.matchAll(COMMAND_PATTERN)].map((match) => unescapeJsString(match[1]!));
            const event: SessionEvent = { at, kind: 'tool', name: payload.name, commands: commands.length ? commands : [input.slice(0, 300)], ok: null };
            pendingCalls.set(payload.call_id, event);
            session.events.push(event);
            return;
        }
        case 'function_call': {
            let args: any = {};
            try {
                args = JSON.parse(payload.arguments ?? '{}');
            } catch {
                // Keep the call even without readable arguments.
            }
            const event: SessionEvent =
                payload.name === 'spawn_agent'
                    ? { at, kind: 'spawn', name: payload.name, agent: args.agent_type, task: args.task_name, ok: null }
                    : { at, kind: 'action', name: payload.name, text: summarizeArgs(args), ok: null };
            pendingCalls.set(payload.call_id, event);
            session.events.push(event);
            return;
        }
        case 'custom_tool_call_output':
        case 'function_call_output': {
            const event = pendingCalls.get(payload.call_id);
            if (!event) {
                return;
            }
            const output = Array.isArray(payload.output) ? textOf(payload.output) : String(payload.output ?? '');
            event.ok = !FAILURE_PATTERN.test(output);
            event.output = output.slice(-1500);
            if (event.at && at) {
                event.seconds = Math.round((Date.parse(at) - Date.parse(event.at)) / 100) / 10;
            }
            return;
        }
        case 'agent_message':
            session.events.push({ at, kind: 'agent-message', from: payload.author, to: payload.recipient });
            return;
    }
}

/** Builds the tree: looks in the file's folder (and `searchRoots`) for sessions whose parent is this one. */
export async function loadCodexTree(file: string, searchRoots: string[] = []): Promise<Session> {
    const parentByFile = new Map<string, string>();
    for (const root of [dirname(file), ...searchRoots]) {
        for await (const candidate of new Glob('**/*.jsonl').scan({ cwd: root, absolute: true })) {
            if (parentByFile.has(candidate)) {
                continue;
            }
            const meta = await readCodexMeta(candidate);
            const parentId = meta?.parent_thread_id ?? spawnInfo(meta).parent_thread_id;
            if (parentId) {
                parentByFile.set(candidate, parentId);
            }
        }
    }

    async function build(sessionFile: string): Promise<Session> {
        const session = await loadCodexSession(sessionFile);
        for (const [childFile, parentId] of parentByFile) {
            if (parentId === session.id) {
                session.children.push(await build(childFile));
            }
        }
        session.children.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
        // The spawn_agent call carries no child id: match spawns to children in start order.
        session.events.filter((event) => event.kind === 'spawn').forEach((event, index) => (event.childId = session.children[index]?.id));
        return session;
    }

    return build(file);
}
