import { expect, test } from 'bun:test';
import { tagEvent } from './classify';

test('tags MCP calls from both tools', () => {
    expect(tagEvent({ at: null, kind: 'tool', name: 'mcp__nixos__nix' }).mcp).toEqual({ server: 'nixos', tool: 'nix' });
    expect(tagEvent({ at: null, kind: 'tool', name: 'clock__curr_time' }).mcp).toEqual({ server: 'clock', tool: 'curr_time' });
    expect(tagEvent({ at: null, kind: 'tool', name: 'exec_command', commands: ['git status'] })).toEqual({});
});

test('tags skills invoked, injected, read and run', () => {
    expect(tagEvent({ at: null, kind: 'tool', name: 'Skill', commands: ['pr-draft'] }).skill).toEqual({ name: 'pr-draft', use: 'invocada' });
    expect(tagEvent({ at: null, kind: 'context', text: '<skill>\n<name>demo-mode</name>\n<path>…' }).skill).toEqual({ name: 'demo-mode', use: 'carregada' });
    expect(tagEvent({ at: null, kind: 'tool', name: 'exec_command', commands: ['cat /nix/store/00000000000000000000000000000000-demo-mode/playbooks/feature.md'] }).skill).toEqual({
        name: 'demo-mode',
        use: 'leu',
    });
    expect(tagEvent({ at: null, kind: 'tool', name: 'exec_command', commands: ['python3 /home/example/.codex-empresa/skills/demo-issue/scripts/issue.py ver 42'] }).skill).toEqual({
        name: 'demo-issue',
        use: 'script',
    });
});
