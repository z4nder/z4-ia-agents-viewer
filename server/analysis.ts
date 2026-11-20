/**
 * Timeline analysis: one lane per agent, with waiting blocks, long processes and tool calls.
 * Pure functions over the session model, shared with the web.
 */

import type { Session, SessionEvent } from './model';

/** A process shorter than this stays a plain tool call. */
export const LONG_PROCESS_MS = 60_000;

export type SegmentKind = 'waiting' | 'process' | 'tool';

export type ProcessResult = 'passed' | 'failed' | 'inconclusive';

export interface Segment {
    kind: SegmentKind;
    start: number;
    end: number;
    label: string;
    /** Model calls made inside the segment and the tokens they sent. */
    calls: number;
    tokens: number;
    ok?: boolean | null;
    result?: ProcessResult;
    /** waiting: how many poll calls were merged into the block. */
    polls?: number;
}

export interface LaneStats {
    calls: number;
    tokens: number;
    waitingMs: number;
    waitingCalls: number;
    waitingTokens: number;
    averageContext: number;
}

export interface Lane {
    sessionId: string;
    label: string;
    depth: number;
    start: number;
    end: number;
    callTimes: number[];
    segments: Segment[];
    stats: LaneStats;
}

export interface Timeline {
    start: number;
    end: number;
    lanes: Lane[];
}

function eventEnd(event: SessionEvent, start: number): number {
    return start + (event.seconds ?? 0) * 1000;
}

export function callsBetween(session: Session, start: number, end: number): { calls: number; tokens: number } {
    let calls = 0;
    let tokens = 0;
    for (const call of session.calls) {
        const at = call.at ? Date.parse(call.at) : NaN;
        if (at >= start && at <= end) {
            calls += 1;
            tokens += call.tokens.total;
        }
    }
    return { calls, tokens };
}

/** Runs of consecutive polls (no real work in between) become one "waiting" block. */
function waitingBlocks(session: Session, toolEvents: SessionEvent[]): Segment[] {
    const blocks: Segment[] = [];
    let run: SessionEvent[] = [];

    const flush = () => {
        const first = run[0];
        const last = run.at(-1);
        if (first?.at && last?.at) {
            const start = Date.parse(first.at);
            const end = eventEnd(last, Date.parse(last.at));
            const names = [...new Set(run.map((event) => event.name))].join(', ');
            blocks.push({ kind: 'waiting', start, end, label: `esperando (${names})`, polls: run.length, ...callsBetween(session, start, end) });
        }
        run = [];
    };

    for (const event of toolEvents) {
        if (event.isPoll) {
            run.push(event);
        } else {
            flush();
        }
    }
    flush();
    return blocks;
}

/** A process that kept running (same processId across calls) or a single call that took long. */
function longProcesses(session: Session, toolEvents: SessionEvent[]): Segment[] {
    const byProcess = new Map<string, SessionEvent[]>();
    const processes: Segment[] = [];

    for (const event of toolEvents) {
        if (event.processId) {
            byProcess.set(event.processId, [...(byProcess.get(event.processId) ?? []), event]);
        } else if (event.at && !event.isPoll && (event.seconds ?? 0) * 1000 >= LONG_PROCESS_MS) {
            const start = Date.parse(event.at);
            const end = eventEnd(event, start);
            processes.push({ kind: 'process', start, end, label: event.commands?.[0] ?? event.name ?? '?', ok: event.ok, result: event.ok === false ? 'failed' : 'passed', ...callsBetween(session, start, end) });
        }
    }

    for (const events of byProcess.values()) {
        const first = events[0]!;
        const last = events.at(-1)!;
        if (!first.at || !last.at) {
            continue;
        }
        const start = Date.parse(first.at);
        const end = eventEnd(last, Date.parse(last.at));
        if (end - start < LONG_PROCESS_MS) {
            continue;
        }
        const exitCode = events.findLast((event) => event.exitCode !== undefined)?.exitCode;
        const result: ProcessResult = exitCode === undefined ? 'inconclusive' : exitCode === 0 ? 'passed' : 'failed';
        const label = events.find((event) => !event.isPoll)?.commands?.[0] ?? `processo ${first.processId}`;
        processes.push({ kind: 'process', start, end, label, result, ok: result === 'passed', ...callsBetween(session, start, end) });
    }
    return processes;
}

export function buildLane(session: Session, depth: number): Lane {
    const toolEvents = session.events.filter((event) => event.kind === 'tool' || event.kind === 'action' || event.kind === 'spawn');
    const waiting = waitingBlocks(session, toolEvents);
    const tools: Segment[] = toolEvents
        .filter((event) => event.at && !event.isPoll)
        .map((event) => {
            const start = Date.parse(event.at!);
            return { kind: 'tool', start, end: eventEnd(event, start), label: event.name ?? '?', ok: event.ok, calls: 0, tokens: 0 };
        });
    const callTimes = session.calls.filter((call) => call.at).map((call) => Date.parse(call.at!));
    const waitingStats = waiting.reduce((sum, block) => ({ ms: sum.ms + (block.end - block.start), calls: sum.calls + block.calls, tokens: sum.tokens + block.tokens }), { ms: 0, calls: 0, tokens: 0 });

    return {
        sessionId: session.id,
        label: session.nickname ? `${session.role} (${session.nickname})` : session.role,
        depth,
        start: session.startedAt ? Date.parse(session.startedAt) : NaN,
        end: session.endedAt ? Date.parse(session.endedAt) : NaN,
        callTimes,
        segments: [...tools, ...longProcesses(session, toolEvents), ...waiting],
        stats: {
            calls: session.calls.length,
            tokens: session.tokens.total,
            waitingMs: waitingStats.ms,
            waitingCalls: waitingStats.calls,
            waitingTokens: waitingStats.tokens,
            averageContext: session.calls.length ? session.tokens.total / session.calls.length : 0,
        },
    };
}

/** Lanes in tree order (leader first, each child right under its parent). */
export function buildTimeline(root: Session): Timeline {
    const lanes: Lane[] = [];
    const visit = (session: Session, depth: number) => {
        lanes.push(buildLane(session, depth));
        session.children.forEach((child) => visit(child, depth + 1));
    };
    visit(root, 0);
    const starts = lanes.map((lane) => lane.start).filter(Number.isFinite);
    const ends = lanes.flatMap((lane) => [lane.end, ...lane.segments.map((segment) => segment.end)]).filter(Number.isFinite);
    return { start: Math.min(...starts), end: Math.max(...ends), lanes };
}
