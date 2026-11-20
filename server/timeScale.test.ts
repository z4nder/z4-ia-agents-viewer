import { expect, test } from 'bun:test';
import { formatElapsed, pickTickStep } from '../src/features/timeline/timeScale';

test('picks a round tick step that keeps labels apart', () => {
    expect(pickTickStep(60 * 60_000, 1000)).toBe(300_000);
    expect(pickTickStep(30_000, 1000)).toBe(5_000);
});

test('formats elapsed time for the axis', () => {
    expect(formatElapsed(45_000)).toBe('+45s');
    expect(formatElapsed(12 * 60_000)).toBe('+12min');
    expect(formatElapsed(90_000)).toBe('+1min30');
    expect(formatElapsed(65 * 60_000)).toBe('+1h05');
});
