import { expect, test } from 'bun:test';
import { defaultFilters } from '../src/features/session-list/sessionFilters';
import { readSessionPreferences, saveSessionPreferences } from '../src/features/session-list/store/sessionPreferences';

function memoryStorage(initial: string | null = null) {
    let saved = initial;
    return { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
}

test('restores filters, search and ordering after a round trip without persisting session data', () => {
    const storage = memoryStorage();
    const preferences = { filters: { ...defaultFilters(), query: 'example', project: 'example', model: 'model-a', tokens: { min: '1000', max: '5000' } }, sort: 'totalTokens' as const, direction: 'asc' as const, sessions: [{ title: 'Must stay in memory' }] };
    saveSessionPreferences(preferences, storage);
    expect(readSessionPreferences(storage)).toEqual({ filters: preferences.filters, sort: 'totalTokens', direction: 'asc' });
    expect(storage.getItem()).not.toContain('Must stay in memory');

    saveSessionPreferences({ ...preferences, filters: defaultFilters() }, storage);
    expect(readSessionPreferences(storage)).toEqual({ filters: defaultFilters(), sort: 'totalTokens', direction: 'asc' });
});

test('handles malformed, missing, outdated and partially invalid stored preferences', () => {
    for (const value of [null, '{broken', 'null', '[]', '{"version":99}']) {
        expect(readSessionPreferences(memoryStorage(value))).toEqual({ filters: defaultFilters(), sort: 'updatedAt', direction: 'desc' });
    }
    const restored = readSessionPreferences(memoryStorage(JSON.stringify({ version: 1, sort: 'invalid', direction: 'invalid', filters: { query: 'example', source: 'invalid', agents: null, duration: { min: '-1', max: 'Infinity' }, tokens: { min: '0', max: '1000' }, from: 'invalid' } })));
    expect(restored.filters).toEqual({ ...defaultFilters(), query: 'example', tokens: { min: '0', max: '1000' } });
    expect(restored.sort).toBe('updatedAt');
    expect(restored.direction).toBe('desc');
});

test('storage failures do not prevent filtering for the current visit', () => {
    const storage = { getItem: () => { throw new Error('Storage blocked'); }, setItem: () => { throw new Error('Storage full'); } };
    expect(readSessionPreferences(storage).filters).toEqual(defaultFilters());
    expect(() => saveSessionPreferences({ filters: defaultFilters(), sort: 'title', direction: 'asc' }, storage)).not.toThrow();
});
