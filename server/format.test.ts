import { expect, test } from 'bun:test';
import { formatDuration, formatTokens } from '../src/lib/format';

test('formats tokens short enough for a stat column', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1234)).toBe('1,2k');
    expect(formatTokens(235_405)).toBe('235k');
    expect(formatTokens(17_891_804)).toBe('17,9M');
});

test('formats durations short, dropping seconds once they stop mattering', () => {
    expect(formatDuration(40_000)).toBe('40s');
    expect(formatDuration(170_000)).toBe('2min50');
    expect(formatDuration(21 * 60_000 + 54_000)).toBe('21min');
    expect(formatDuration(62 * 60_000 + 47_000)).toBe('1h02');
    expect(formatDuration(null)).toBe('?');
});
