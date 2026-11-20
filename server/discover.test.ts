import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { listSessions, recordingsDir } from './discover';

describe.skipIf(!existsSync(recordingsDir))('listSessions', () => {
    test('lists only root sessions of the recordings, with title and folder', async () => {
        const sessions = await listSessions([{ source: 'gravada', dir: recordingsDir, pattern: '*/*.jsonl' }]);
        const byId = new Map(sessions.map((session) => [session.id, session]));

        expect(byId.get('11111111-1111-4111-8111-111111111111')?.cwd).toEndWith('/example-project');
        expect(byId.get('22222222-2222-4222-8222-222222222222')?.title).toBe('Example session');
        expect(sessions.some((session) => session.file.includes('demo-julgamento'))).toBe(false);
        expect(sessions.every((session) => session.source === 'gravada')).toBe(true);
    });
});
