/**
 * Local read-only API for the web. It never writes to the tools' files.
 * Usage: bun server/index.ts   (PORT, default 5175)
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { loadSessionTree } from './load';

const home = homedir();
const allowedRoots = [
    `${home}/.claude/projects`,
    `${home}/.codex`,
    `${home}/.codex-empresa`,
    process.env.SESSIONS_DIR ?? `${home}/.local/share/agent-viewer/recordings`,
];

function isAllowed(file: string): boolean {
    const absolute = resolve(file);
    return absolute.endsWith('.jsonl') && allowedRoots.some((root) => absolute.startsWith(`${root}/`));
}

const server = Bun.serve({
    port: Number(process.env.PORT ?? 5175),
    hostname: '127.0.0.1',
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/api/session') {
            const file = url.searchParams.get('file') ?? '';
            if (!isAllowed(file)) {
                return Response.json({ error: 'Arquivo fora das pastas de sessão' }, { status: 400 });
            }
            try {
                return Response.json(await loadSessionTree(resolve(file)));
            } catch (error) {
                return Response.json({ error: String(error) }, { status: 500 });
            }
        }
        return new Response('Not found', { status: 404 });
    },
});

console.log(`API em http://${server.hostname}:${server.port}`);
