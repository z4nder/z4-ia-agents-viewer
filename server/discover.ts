/**
 * Discovers sessions and combines cached per-file metrics across their agents.
 */

import { Glob } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { SessionSource, SessionSummary } from './model';
import { combineMetrics, readSessionMetrics, type FileMetrics } from './sessionMetrics';

export type { SessionSource, SessionSummary };

const HEAD_BYTES = 256 * 1024;

interface SourceRoot {
    source: SessionSource;
    dir: string;
    pattern: string;
}

const home = homedir();

export const recordingsDir = process.env.SESSIONS_DIR ?? `${home}/.local/share/agent-viewer/recordings`;

export const sourceRoots: SourceRoot[] = [
    { source: 'claude', dir: `${home}/.claude/projects`, pattern: '*/*.jsonl' },
    { source: 'codex', dir: `${home}/.codex/sessions`, pattern: '**/rollout-*.jsonl' },
    { source: 'codex-empresa', dir: `${home}/.codex-empresa/sessions`, pattern: '**/rollout-*.jsonl' },
    { source: 'gravada', dir: recordingsDir, pattern: '*/*.jsonl' },
];

interface Candidate extends SessionSummary {
    parentId: string | null;
}

const cache = new Map<string, { mtimeMs: number; size: number; summary: Candidate | null }>();
const metricsCache = new Map<string, { mtimeMs: number; size: number; value: Promise<FileMetrics> }>();

function metricsFor(file: string, tool: SessionSummary['tool']): Promise<FileMetrics> {
    const stat = statSync(file);
    const cached = metricsCache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.value;
    const value = readSessionMetrics(file, tool);
    const entry = { mtimeMs: stat.mtimeMs, size: stat.size, value };
    metricsCache.set(file, entry);
    void value.catch(() => {
        if (metricsCache.get(file) === entry) metricsCache.delete(file);
    });
    return value;
}

function parseLines(text: string): any[] {
    const lines: any[] = [];
    for (const line of text.split('\n')) {
        try {
            lines.push(JSON.parse(line));
        } catch {
            // Cut at the head boundary.
        }
    }
    return lines;
}

function firstText(content: unknown): string | null {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content.find((block) => typeof block?.text === 'string')?.text ?? null;
    }
    return null;
}

function promptTitle(text: string | null): string | null {
    if (!text || text.startsWith('<')) {
        return null;
    }
    const line = text.trim().split('\n')[0] ?? '';
    return line.length > 90 ? `${line.slice(0, 90)}…` : line;
}

function summarizeClaude(lines: any[]): Partial<SessionSummary> | null {
    const withSession = lines.find((entry) => typeof entry.sessionId === 'string' && entry.timestamp);
    if (!withSession) {
        return null;
    }
    const aiTitle = lines.findLast((entry) => entry.type === 'ai-title')?.aiTitle ?? null;
    const firstPrompt = lines.filter((entry) => entry.type === 'user').map((entry) => promptTitle(firstText(entry.message?.content))).find(Boolean) ?? null;
    return {
        tool: 'claude',
        id: withSession.sessionId,
        title: aiTitle ?? firstPrompt,
        cwd: lines.find((entry) => entry.cwd)?.cwd ?? null,
        startedAt: withSession.timestamp,
    };
}

function summarizeCodex(lines: any[], titles: Map<string, string>): Partial<Candidate> | null {
    const meta = lines.find((entry) => entry.type === 'session_meta')?.payload;
    if (!meta) {
        return null;
    }
    const spawn = meta.source && typeof meta.source === 'object' ? meta.source.subagent?.thread_spawn : undefined;
    const firstPrompt =
        lines
            .filter((entry) => entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role === 'user')
            .map((entry) => promptTitle(firstText(entry.payload.content)))
            .find((title) => title && !title.startsWith('# AGENTS.md')) ?? null;
    return {
        tool: 'codex', id: meta.id, parentId: meta.parent_thread_id ?? spawn?.parent_thread_id ?? null,
        title: titles.get(meta.id) ?? firstPrompt, cwd: meta.cwd ?? null,
        startedAt: meta.timestamp ?? lines[0]?.timestamp ?? null,
    };
}

/** Codex keeps the thread names in <home>/session_index.jsonl. */
async function readCodexTitles(sessionsDir: string): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const index = Bun.file(join(sessionsDir, '..', 'session_index.jsonl'));
    if (!(await index.exists())) {
        return titles;
    }
    for (const entry of parseLines(await index.text())) {
        if (entry?.id && entry.thread_name) {
            titles.set(entry.id, entry.thread_name);
        }
    }
    return titles;
}

async function summarize(file: string, source: SessionSource, codexTitles: Map<string, string>): Promise<Candidate | null> {
    const stat = statSync(file);
    const cached = cache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        const summary = cached.summary;
        return summary ? { ...summary, source, title: codexTitles.get(summary.id) ?? summary.title } : null;
    }
    const lines = parseLines(await Bun.file(file).slice(0, HEAD_BYTES).text());
    const isCodex = lines[0]?.type === 'session_meta';
    const partial: Partial<Candidate> | null = isCodex ? summarizeCodex(lines, codexTitles) : summarizeClaude(lines);
    const summary: Candidate | null = partial
        ? {
              file,
              source,
              tool: partial.tool!,
              id: partial.id ?? basename(file, '.jsonl'),
              title: partial.title ?? null,
              cwd: partial.cwd ?? null,
              startedAt: partial.startedAt ?? null,
              updatedAt: new Date(stat.mtimeMs).toISOString(),
              sizeBytes: stat.size,
              parentId: partial.parentId ?? null,
              agentCount: 1,
              callCount: 0,
              totalTokens: 0,
              durationMs: null,
              models: [],
          }
        : null;
    cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, summary });
    return summary;
}

/** All root sessions, most recently updated first. */
export async function listSessions(roots: SourceRoot[] = sourceRoots): Promise<SessionSummary[]> {
    const candidates: Candidate[] = [];
    for (const root of roots) {
        if (!existsSync(root.dir)) {
            continue;
        }
        const codexTitles = root.source.startsWith('codex') ? await readCodexTitles(root.dir) : new Map<string, string>();
        for await (const file of new Glob(root.pattern).scan({ cwd: root.dir, absolute: true })) {
            const summary = await summarize(file, root.source, codexTitles);
            if (summary) {
                candidates.push(summary);
            }
        }
    }
    // Scan each log once, with bounded concurrency instead of reloading every tree.
    const files = [...new Map(candidates.map((session) => [session.file, session])).values()];
    const own = new Map<string, FileMetrics>();
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
        while (cursor < files.length) {
            const session = files[cursor++]!;
            own.set(session.file, await metricsFor(session.file, session.tool));
        }
    }));
    const children = new Map<string, Candidate[]>();
    const key = (session: Candidate, id: string) => `${session.source}:${session.tool}:${id}`;
    for (const session of candidates) {
        if (session.parentId) {
            const parentKey = key(session, session.parentId);
            const siblings = children.get(parentKey) ?? [];
            siblings.push(session);
            children.set(parentKey, siblings);
        }
    }

    const summaries: SessionSummary[] = [];
    for (const root of candidates.filter((session) => !session.parentId)) {
        const parts: FileMetrics[] = [];
        const visited = new Set<string>();
        let updatedAt = root.updatedAt;
        function collect(session: Candidate) {
            if (visited.has(session.file)) return;
            visited.add(session.file);
            parts.push(own.get(session.file)!);
            if (session.updatedAt > updatedAt) updatedAt = session.updatedAt;
            for (const child of children.get(key(session, session.id)) ?? []) collect(child);
        }
        collect(root);
        if (root.tool === 'claude') {
            const dir = root.file.replace(/\.jsonl$/, '') + '/subagents';
            if (existsSync(dir)) {
                for await (const file of new Glob('agent-*.jsonl').scan({ cwd: dir, absolute: true })) {
                    if (visited.has(file)) continue;
                    visited.add(file);
                    parts.push(await metricsFor(file, 'claude'));
                    const changed = new Date(statSync(file).mtimeMs).toISOString();
                    if (changed > updatedAt) updatedAt = changed;
                }
            }
        }
        const metrics = combineMetrics(parts);
        const { parentId: _, ...summary } = root;
        summaries.push({
            ...summary, updatedAt, agentCount: visited.size,
            callCount: metrics.callCount, totalTokens: metrics.totalTokens, models: metrics.models,
            durationMs: metrics.start === null || metrics.end === null ? null : metrics.end - metrics.start,
        });
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
