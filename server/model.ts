/** Common session model, shared with the web: types and pure helpers only, no Bun APIs. */

export type Tool = 'codex' | 'claude';

/** Where a session was found; `gravada` is a locally saved recording. */
export type SessionSource = 'claude' | 'codex' | 'codex-empresa' | 'gravada';

export interface SessionSummary {
    file: string;
    tool: Tool;
    source: SessionSource;
    id: string;
    title: string | null;
    cwd: string | null;
    startedAt: string | null;
    updatedAt: string;
    sizeBytes: number;
}

export type SessionStatus = 'running' | 'finished' | 'failed' | 'unknown';

/**
 * Normalized tokens. `input` is the uncached part only; `total` = input + cacheRead + cacheWrite + output.
 * `reasoning` is already counted inside `output` for both tools.
 */
export interface Tokens {
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
    total: number;
}

export type EventKind = 'user' | 'context' | 'reply' | 'tool' | 'spawn' | 'action' | 'agent-message';

export interface SessionEvent {
    at: string | null;
    kind: EventKind;
    name?: string;
    text?: string;
    commands?: string[];
    ok?: boolean | null;
    exitCode?: number;
    /** A process that kept running after the call returned (Codex exec session_id); polls point to it too. */
    processId?: string;
    /** Waiting for something else (wait_agent, polling a running process): no work of its own. */
    isPoll?: boolean;
    output?: string;
    seconds?: number;
    /** spawn: agent type, task and the child session it created. */
    agent?: string;
    task?: string;
    childId?: string;
    /** agent-message */
    from?: string;
    to?: string;
}

/** One model call, for the timeline and the average context per call. */
export interface ModelCall {
    at: string | null;
    tokens: Tokens;
}

export interface Session {
    id: string;
    tool: Tool;
    file: string;
    title: string | null;
    parentId: string | null;
    role: string;
    nickname: string | null;
    cwd: string | null;
    model: string | null;
    effort: string | null;
    startedAt: string | null;
    endedAt: string | null;
    durationMs: number | null;
    status: SessionStatus;
    tokens: Tokens;
    calls: ModelCall[];
    events: SessionEvent[];
    children: Session[];
}

export function emptyTokens(): Tokens {
    return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0, total: 0 };
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
    return {
        input: a.input + b.input,
        cacheRead: a.cacheRead + b.cacheRead,
        cacheWrite: a.cacheWrite + b.cacheWrite,
        output: a.output + b.output,
        reasoning: a.reasoning + b.reasoning,
        total: a.total + b.total,
    };
}

/** Tokens of the session plus all its descendants. */
export function treeTokens(session: Session): Tokens {
    return session.children.reduce((sum, child) => addTokens(sum, treeTokens(child)), session.tokens);
}

export function durationBetween(start: string | null, end: string | null): number | null {
    if (!start || !end) {
        return null;
    }
    return Date.parse(end) - Date.parse(start);
}

export function newSession(fields: Pick<Session, 'id' | 'tool' | 'file'> & Partial<Session>): Session {
    return {
        title: null,
        parentId: null,
        role: 'líder',
        nickname: null,
        cwd: null,
        model: null,
        effort: null,
        startedAt: null,
        endedAt: null,
        durationMs: null,
        status: 'unknown',
        tokens: emptyTokens(),
        calls: [],
        events: [],
        children: [],
        ...fields,
    };
}

/** Sums the calls into `tokens`, sets the duration and tracks the first and last timestamp. */
export function finishSession(session: Session): Session {
    session.tokens = session.calls.reduce((sum, call) => addTokens(sum, call.tokens), emptyTokens());
    session.durationMs = durationBetween(session.startedAt, session.endedAt);
    return session;
}

export function trackTimestamp(session: Session, at: string | null): void {
    if (!at) {
        return;
    }
    session.startedAt ??= at;
    session.endedAt = at;
}
