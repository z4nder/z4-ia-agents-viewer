import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Tool } from './model';

export interface FileMetrics {
    callCount: number;
    totalTokens: number;
    models: string[];
    start: number | null;
    end: number | null;
}

/** Streams the log without retaining prompts, outputs or the full session tree. */
export async function readSessionMetrics(file: string, tool: Tool): Promise<FileMetrics> {
    const metrics: FileMetrics = { callCount: 0, totalTokens: 0, models: [], start: null, end: null };
    const models = new Set<string>();
    const messages = new Set<string>();
    let usageCalls = 0;
    let usageTokens = 0;
    let lastCumulativeUsage = '';
    const stream = createReadStream(file, { encoding: 'utf8' });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    try {
        for await (const line of lines) {
            let entry: any;
            try {
                entry = JSON.parse(line);
            } catch {
                continue; // Active logs may have a partially written last line.
            }
            if (!entry || typeof entry !== 'object') continue;
            const payload = entry.payload ?? {};
            const message = entry.message ?? {};
            const relevant = tool === 'codex' || entry.type === 'user' || entry.type === 'assistant';
            const at = relevant ? Date.parse(entry.timestamp) : NaN;
            if (Number.isFinite(at)) {
                metrics.start = metrics.start === null ? at : Math.min(metrics.start, at);
                metrics.end = metrics.end === null ? at : Math.max(metrics.end, at);
            }
            const model = tool === 'codex'
                ? (entry.type === 'turn_context' ? payload.model : null)
                : (entry.type === 'assistant' ? message.model : null);
            if (typeof model === 'string' && model && model !== '<synthetic>') models.add(model);

            if (tool === 'claude' && entry.type === 'assistant' && message.usage && message.id && !messages.has(message.id)) {
                messages.add(message.id);
                const usage = message.usage;
                metrics.callCount++;
                metrics.totalTokens += amount(usage.input_tokens) + amount(usage.output_tokens)
                    + amount(usage.cache_read_input_tokens) + amount(usage.cache_creation_input_tokens);
            } else if (tool === 'codex' && entry.type === 'token_usage_record') {
                metrics.callCount++;
                metrics.totalTokens += amount(payload.usage?.input_tokens) + amount(payload.usage?.output_tokens);
            } else if (tool === 'codex' && entry.type === 'event_msg' && payload.type === 'token_count' && payload.info?.last_token_usage) {
                const cumulative = payload.info.total_token_usage;
                const signature = cumulative ? JSON.stringify(cumulative) : '';
                // Codex can repeat the latest cumulative usage without another model call.
                if (signature && signature === lastCumulativeUsage) continue;
                lastCumulativeUsage = signature;
                usageCalls++;
                const usage = payload.info.last_token_usage;
                usageTokens += amount(usage.input_tokens) + amount(usage.output_tokens);
            }
        }
    } finally {
        lines.close();
        stream.destroy();
    }
    // Some Codex versions use event_msg instead; never count both formats together.
    if (tool === 'codex' && metrics.callCount === 0) {
        metrics.callCount = usageCalls;
        metrics.totalTokens = usageTokens;
    }
    metrics.models = [...models].sort();
    return metrics;
}

function amount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function combineMetrics(files: FileMetrics[]): FileMetrics {
    const starts = files.flatMap((file) => file.start === null ? [] : [file.start]);
    const ends = files.flatMap((file) => file.end === null ? [] : [file.end]);
    return {
        callCount: files.reduce((sum, file) => sum + file.callCount, 0),
        totalTokens: files.reduce((sum, file) => sum + file.totalTokens, 0),
        models: [...new Set(files.flatMap((file) => file.models))].sort(),
        start: starts.length ? starts.reduce((a, b) => Math.min(a, b)) : null,
        end: ends.length ? ends.reduce((a, b) => Math.max(a, b)) : null,
    };
}
