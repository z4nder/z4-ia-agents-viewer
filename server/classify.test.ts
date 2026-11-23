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
        resource: { kind: 'doc', path: 'playbooks/feature.md', folder: 'playbooks', name: 'feature' },
    });
    expect(tagEvent({ at: null, kind: 'tool', name: 'exec_command', commands: ["python3 /home/example/.codex-empresa/skills/demo-pr/scripts/pr.py abrir --titulo 'feat: x'"] }).skill).toEqual({
        name: 'demo-pr',
        use: 'script',
        resource: { kind: 'script', path: 'scripts/pr.py', folder: 'scripts', name: 'pr.py', subcommand: 'abrir' },
    });
});

test('tags delegations and messages between agents', () => {
    expect(tagEvent({ at: null, kind: 'spawn', name: 'spawn_agent', agent: 'demo-julgamento' }).agent).toEqual({ direction: 'delegated', peer: 'demo-julgamento' });
    expect(tagEvent({ at: null, kind: 'action', name: 'send_message', text: 'target=implementar' }).agent).toEqual({ direction: 'sent', peer: 'implementar' });
    expect(tagEvent({ at: null, kind: 'agent-message', from: '/root', to: '/root/implementar' }).agent).toEqual({ direction: 'received', peer: '/root' });
});

test('keeps every skill a parallel call touched', () => {
    const tags = tagEvent({
        at: null,
        kind: 'tool',
        name: 'exec_command',
        commands: ['cat /nix/store/00000000000000000000000000000000-demo-mode/playbooks/feature.md', 'cat /home/example/.codex-empresa/skills/demo-issue/SKILL.md', 'git status'],
    });

    expect(tags.skills?.map((skill) => `${skill.name}:${skill.resource?.path}`)).toEqual(['demo-mode:playbooks/feature.md', 'demo-issue:SKILL.md']);
});

test('ignores markdown in the Nix store outside a skill-like layout', () => {
    expect(tagEvent({ at: null, kind: 'tool', name: 'exec_command', commands: ['cat /nix/store/00000000000000000000000000000000-hello-2.12/README.md'] })).toEqual({});
});
