/**
 * Prints a session tree with tokens, calls and duration per agent.
 * Usage: bun server/cli.ts FILE.jsonl [--json]
 */

import { loadSessionTree } from './load';
import { treeTokens, type Session } from './model';

const numberFormat = new Intl.NumberFormat('pt-BR');

function formatDuration(ms: number | null): string {
    if (ms === null) {
        return '?';
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

function printTree(session: Session, depth = 0): void {
    const indent = '  '.repeat(depth);
    const name = [session.role, session.nickname].filter(Boolean).join(' · ');
    const toolCount = session.events.filter((event) => event.kind === 'tool' || event.kind === 'action').length;
    console.log(
        `${indent}${name}  [${session.model ?? '?'}]  ${numberFormat.format(session.tokens.total)} tokens  ` +
            `${session.calls.length} chamadas  ${toolCount} ferramentas  ${formatDuration(session.durationMs)}  ${session.status}`,
    );
    for (const child of session.children) {
        printTree(child, depth + 1);
    }
}

const [file, ...flags] = process.argv.slice(2);
if (!file) {
    console.error('Uso: bun server/cli.ts ARQUIVO.jsonl [--json]');
    process.exit(1);
}

const session = await loadSessionTree(file);
if (flags.includes('--json')) {
    console.log(JSON.stringify(session, null, 2));
} else {
    console.log(`${session.tool} · ${session.title ?? session.id}\n`);
    printTree(session);
    console.log(`\ntotal da árvore: ${numberFormat.format(treeTokens(session).total)} tokens`);
}
