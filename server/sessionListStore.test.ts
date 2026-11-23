import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { useSessionListStore } from '../src/features/session-list/store/sessionListStore';

afterEach(() => {
    mock.restore();
    useSessionListStore.setState({ sessions: [], isLoading: false, error: null });
});

test('reports an unavailable API and recovers on refresh', async () => {
    const fetch = spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await useSessionListStore.getState().refresh();
    expect(useSessionListStore.getState().error).toContain('Verifique a API');
    expect(useSessionListStore.getState().isLoading).toBe(false);

    fetch.mockResolvedValueOnce(Response.json([]));
    await useSessionListStore.getState().refresh();
    expect(useSessionListStore.getState().error).toBeNull();
    expect(useSessionListStore.getState().sessions).toEqual([]);
});

test('keeps the session list usable when the proxy returns HTTP 500', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Proxy error', { status: 500 }));
    await useSessionListStore.getState().refresh();
    expect(useSessionListStore.getState().error).not.toBeNull();
    expect(useSessionListStore.getState().sessions).toEqual([]);
    expect(useSessionListStore.getState().isLoading).toBe(false);
});
