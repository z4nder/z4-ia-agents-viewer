/**
 * Claude Code adapter: ~/.claude/projects/<project>/<sessionId>.jsonl, with subagents in
 * <sessionId>/subagents/agent-<agentId>.jsonl plus a .meta.json ({ agentType, description, toolUseId, spawnDepth }).
 *
 * One model response is written as several `assistant` lines (one per content block), all carrying the
 * same `usage`: calls are deduplicated by `message.id` before summing.
 */

import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJsonl } from '../jsonl';
import { finishSession, newSession, trackTimestamp, type Session, type SessionEvent, type Tokens } from '../model';

const SPAWN_TOOLS = new Set(['Agent', 'Task']);

interface SubagentMeta {
    agentType?: string;
    description?: string;
    toolUseId?: string;
    spawnDepth?: number;
}

interface TaskNotification {
    agentId: string;
    status: string;
    durationMs: number | null;
}

function normalizeUsage(usage: any): Tokens {
    const input = usage.input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    return {
        input,
        cacheRead,
        cacheWrite,
        output,
        reasoning: usage.output_tokens_details?.thinking_tokens ?? 0,
        total: input + cacheRead + cacheWrite + output,
    };
}

function textOf(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .filter((block) => block?.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
}

/** What the call did, in one line: the shell command, the file, the URL… */
function describeToolInput(name: string, input: any): string[] {
    if (input?.command) {
        return [String(input.command)];
    }
    const summary = input?.file_path ?? input?.url ?? input?.pattern ?? input?.query ?? input?.skill ?? null;
    return [summary ? String(summary) : JSON.stringify(input ?? {}).slice(0, 300)];
}

function parseTaskNotification(text: string): TaskNotification | null {
    if (!text.includes('<task-notification>')) {
        return null;
    }
    const tag = (name: string) => text.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;
    const agentId = tag('task-id');
    if (!agentId) {
        return null;
    }
    const duration = tag('duration_ms');
    return { agentId, status: tag('status') ?? 'unknown', durationMs: duration ? Number(duration) : null };
}

export function isClaudeLine(firstLine: any): boolean {
    return typeof firstLine?.sessionId === 'string' || ['permission-mode', 'file-history-snapshot', 'queue-operation'].includes(firstLine?.type);
}

interface LoadedClaudeSession {
    session: Session;
    /** tool_use id of each spawn → the event, so children can be attached to the right parent. */
    spawnsByToolUseId: Map<string, SessionEvent>;
    notifications: TaskNotification[];
    /** Subagents only: the parent's tool_use that created this one. */
    spawnedBy?: string;
}

async function loadClaudeFile(file: string, fields: Partial<Session>): Promise<LoadedClaudeSession> {
    const lines = await readJsonl(file);
    const session = newSession({ id: basename(file, '.jsonl'), tool: 'claude', file, ...fields });
    const callsByMessageId = new Map<string, { at: string | null; tokens: Tokens }>();
    const pendingTools = new Map<string, SessionEvent>();
    const spawnsByToolUseId = new Map<string, SessionEvent>();
    const notifications: TaskNotification[] = [];

    for (const entry of lines) {
        const at: string | null = entry.timestamp ?? null;
        if (entry.type === 'ai-title') {
            session.title = entry.aiTitle ?? session.title;
            continue;
        }
        if (entry.type !== 'user' && entry.type !== 'assistant') {
            continue;
        }
        trackTimestamp(session, at);
        session.cwd ??= entry.cwd ?? null;
        if (!fields.id && entry.sessionId) {
            session.id = entry.sessionId;
        }

        if (entry.type === 'assistant') {
            const message = entry.message ?? {};
            session.model = message.model ?? session.model;
            session.effort = entry.effort ?? session.effort;
            if (message.usage && message.id && !callsByMessageId.has(message.id)) {
                callsByMessageId.set(message.id, { at, tokens: normalizeUsage(message.usage) });
            }
            for (const block of message.content ?? []) {
                if (block.type === 'text' && block.text?.trim()) {
                    session.events.push({ at, kind: 'reply', text: block.text });
                } else if (block.type === 'tool_use') {
                    const event: SessionEvent = SPAWN_TOOLS.has(block.name)
                        ? { at, kind: 'spawn', name: block.name, agent: block.input?.subagent_type ?? 'general-purpose', task: block.input?.description, ok: null }
                        : { at, kind: 'tool', name: block.name, commands: describeToolInput(block.name, block.input), ok: null };
                    pendingTools.set(block.id, event);
                    if (event.kind === 'spawn') {
                        spawnsByToolUseId.set(block.id, event);
                    }
                    session.events.push(event);
                }
            }
            continue;
        }

        const content = entry.message?.content;
        if (typeof content === 'string' || content?.some?.((block: any) => block.type === 'text')) {
            const text = textOf(content).trim();
            const notification = parseTaskNotification(text);
            if (notification) {
                notifications.push(notification);
            } else if (text) {
                session.events.push({ at, kind: text.startsWith('<') ? 'context' : 'user', text });
            }
        }
        for (const block of Array.isArray(content) ? content : []) {
            if (block.type !== 'tool_result') {
                continue;
            }
            const event = pendingTools.get(block.tool_use_id);
            if (!event) {
                continue;
            }
            const output = textOf(block.content);
            event.ok = !block.is_error;
            event.output = output.slice(-1500);
            if (event.at && at) {
                event.seconds = Math.round((Date.parse(at) - Date.parse(event.at)) / 100) / 10;
            }
            const agentId = entry.toolUseResult?.agentId;
            if (event.kind === 'spawn' && agentId) {
                event.childId = agentId;
            }
        }
    }

    session.calls = [...callsByMessageId.values()];
    return { session: finishSession(session), spawnsByToolUseId, notifications };
}

/** Loads the main session and its subagents (any depth: they all live flat in the same subagents folder). */
export async function loadClaudeTree(file: string): Promise<Session> {
    const root = await loadClaudeFile(file, {});
    const loaded: LoadedClaudeSession[] = [root];
    const subagentsDir = join(file.replace(/\.jsonl$/, ''), 'subagents');

    if (existsSync(subagentsDir)) {
        for await (const agentFile of new Glob('agent-*.jsonl').scan({ cwd: subagentsDir, absolute: true })) {
            const metaFile = Bun.file(agentFile.replace(/\.jsonl$/, '.meta.json'));
            const meta: SubagentMeta = (await metaFile.exists()) ? await metaFile.json() : {};
            const child = await loadClaudeFile(agentFile, {
                id: basename(agentFile, '.jsonl').replace(/^agent-/, ''),
                role: meta.agentType ?? 'subagent',
                nickname: meta.description ?? null,
            });
            child.spawnedBy = meta.toolUseId;
            loaded.push(child);
        }
    }

    attachChildren(loaded);
    return root.session;
}

/** Each child goes under the session that holds its spawn's tool_use; unmatched ones go under the root. */
function attachChildren(loaded: LoadedClaudeSession[]): void {
    const [root, ...children] = loaded;
    const notifications = loaded.flatMap((item) => item.notifications);
    for (const child of children) {
        const toolUseId = child.spawnedBy;
        const parent = loaded.find((candidate) => candidate !== child && toolUseId && candidate.spawnsByToolUseId.has(toolUseId)) ?? root!;
        const spawn = toolUseId ? parent.spawnsByToolUseId.get(toolUseId) : undefined;
        if (spawn) {
            spawn.childId = child.session.id;
        }
        child.session.parentId = parent.session.id;
        const notification = notifications.findLast((item) => item.agentId === child.session.id);
        child.session.status = notification ? (notification.status === 'completed' ? 'finished' : 'failed') : 'unknown';
        parent.session.children.push(child.session);
    }
    for (const item of loaded) {
        item.session.children.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
    }
}
