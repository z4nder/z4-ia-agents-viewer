import { isClaudeLine, loadClaudeTree } from './adapters/claude';
import { isCodexLine, loadCodexTree } from './adapters/codex';
import type { Session } from './model';

/** Detects the tool from the first line and loads the session with its subagents. */
export async function loadSessionTree(file: string, codexSearchRoots: string[] = []): Promise<Session> {
    const head = await Bun.file(file).slice(0, 64 * 1024).text();
    const firstLine = JSON.parse(head.split('\n')[0] ?? '{}');
    if (isCodexLine(firstLine)) {
        return loadCodexTree(file, codexSearchRoots);
    }
    if (isClaudeLine(firstLine)) {
        return loadClaudeTree(file);
    }
    throw new Error(`Formato de sessão desconhecido: ${file}`);
}
