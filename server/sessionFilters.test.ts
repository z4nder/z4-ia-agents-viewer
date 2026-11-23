import { expect, test } from 'bun:test';
import type { SessionSummary } from './model';
import { activeFilterCount, defaultFilters, filterSessions, sortSessions } from '../src/features/session-list/sessionFilters';

function summary(fields: Partial<SessionSummary> = {}): SessionSummary {
    return {
        file: 'example.jsonl', id: 'example', tool: 'codex', source: 'codex', title: 'Revisão de código',
        cwd: '/projects/example', startedAt: null, updatedAt: new Date(2025, 0, 1, 23, 30).toISOString(), sizeBytes: 0,
        agentCount: 3, callCount: 20, totalTokens: 1000, durationMs: 120_000, models: ['model-a', 'model-b'], ...fields,
    };
}

test('combines case/accent-insensitive title search, descendant model, project, dates and inclusive numeric ranges', () => {
    const filters = { ...defaultFilters(), query: ' REVISAO ', source: 'codex' as const, model: 'model-b', project: 'example',
        from: '2025-01-01', to: '2025-01-01', agents: { min: '3', max: '3' }, calls: { min: '20', max: '20' },
        tokens: { min: '1000', max: '1000' }, duration: { min: '2', max: '2' } };
    expect(filterSessions([summary(), summary({ title: 'Outra sessão' }), summary({ models: ['model-a'] }), summary({ totalTokens: 999 })], filters)).toHaveLength(1);
    expect(activeFilterCount(filters)).toBe(9);
});

test('empty limits keep zero and unknown duration; duration ranges exclude unknown values', () => {
    const sessions = [summary({ callCount: 0, totalTokens: 0, durationMs: null })];
    expect(filterSessions(sessions, defaultFilters())).toHaveLength(1);
    expect(filterSessions(sessions, { ...defaultFilters(), duration: { min: '0', max: '' } })).toHaveLength(0);
    expect(filterSessions([summary()], { ...defaultFilters(), calls: { min: '30', max: '10' } })).toHaveLength(0);
});

test('numeric sort works in both directions without mutating input and keeps missing values last', () => {
    const sessions = [summary({ file: 'a', callCount: 100, durationMs: null }), summary({ file: 'b', callCount: 2 }), summary({ file: 'c', callCount: 20 })];
    expect(sortSessions(sessions, 'callCount', 'asc').map((item) => item.file)).toEqual(['b', 'c', 'a']);
    expect(sortSessions(sessions, 'callCount', 'desc').map((item) => item.file)).toEqual(['a', 'c', 'b']);
    expect(sessions.map((item) => item.file)).toEqual(['a', 'b', 'c']);
    expect(sortSessions(sessions, 'durationMs', 'desc').at(-1)?.file).toBe('a');
    expect(sortSessions(sessions, 'durationMs', 'asc').at(-1)?.file).toBe('a');
});

test('name and model ordering are alphabetical and stable', () => {
    const sessions = [summary({ file: 'b', title: 'Zeta', models: ['model-b'] }), summary({ file: 'a', title: 'Alfa', models: ['model-a'] }), summary({ file: 'c', title: null, models: [] })];
    expect(sortSessions(sessions, 'title', 'asc').map((item) => item.file)).toEqual(['a', 'b', 'c']);
    expect(sortSessions(sessions, 'models', 'asc').map((item) => item.file)).toEqual(['a', 'b', 'c']);
});
