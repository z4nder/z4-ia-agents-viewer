/**
 * Tags MCP and skill usage on events. Pure functions shared with the web.
 *
 * MCP: Claude names tools `mcp__<server>__<tool>`; Codex calls `tools.<server>__<tool>` from exec.
 * Skills: Claude has a `Skill` tool; Codex has none, so a skill shows up as context injected when it is
 * invoked (`<skill><name>…</name>`), reading one of its files, or running one of its scripts. The file or
 * script is kept (`resource`), so the UI can say "read playbooks/feature.md" or "ran pr.py abrir".
 */

import type { SessionEvent } from './model';

export type SkillUse = 'invocada' | 'carregada' | 'leu' | 'script';

export interface McpTag {
    server: string;
    tool: string;
}

/** The part of a skill that was used: a file it read or a script it ran. */
export interface SkillResource {
    kind: 'doc' | 'script';
    /** Path inside the skill: SKILL.md, playbooks/feature.md, scripts/pr.py. */
    path: string;
    /** First folder of the path (playbooks, references…), null at the skill root. */
    folder: string | null;
    /** File name without .md for docs, script file name for scripts. */
    name: string;
    /** Scripts: the first argument that isn't a flag (pr.py abrir → abrir). */
    subcommand?: string;
}

export interface SkillTag {
    name: string;
    use: SkillUse;
    resource?: SkillResource;
}

export type AgentDirection = 'delegated' | 'sent' | 'received';

/** Talking to another agent. `peer` is an agent type (delegated) or address/name (messages). */
export interface AgentTag {
    direction: AgentDirection;
    peer: string | null;
}

export interface EventTags {
    mcp?: McpTag;
    /** The first skill touched (for the badge); `skills` has all of them when a call touches several. */
    skill?: SkillTag;
    skills?: SkillTag[];
    agent?: AgentTag;
}

const SEND_TOOLS = new Set(['send_message', 'SendMessage']);
const TARGET_PATTERN = /\b(?:target|to|recipient)=(\S+)/;

const CLAUDE_MCP_PATTERN = /^mcp__(.+?)__(.+)$/;
const CODEX_MCP_PATTERN = /^([a-z0-9-]+)__([a-z0-9_]+)$/i;
const INJECTED_SKILL_PATTERN = /<skill>\s*<name>([^<]+)<\/name>/;
/**
 * ~/.<tool>/skills/<name>/<path>, or a skill in the Nix store: /nix/store/<hash>-<name>/ followed by
 * SKILL.md, a script, or a markdown file in a subfolder (playbooks/feature.md, references/api.md).
 */
const SKILL_PATH_PATTERN = /\/skills\/([\w.-]+)\/([\w./-]*)|\/nix\/store\/[a-z0-9]{32}-([\w.-]+)\/(SKILL\.md|scripts\/[\w./-]+|[\w.-]+\/[\w./-]+\.md)/g;

function mcpTag(name: string | undefined): McpTag | undefined {
    if (!name) {
        return undefined;
    }
    const match = name.match(CLAUDE_MCP_PATTERN) ?? name.match(CODEX_MCP_PATTERN);
    return match ? { server: match[1]!, tool: match[2]! } : undefined;
}

function subcommandAfter(command: string, end: number): string | undefined {
    const token = command.slice(end).trim().split(/\s+/)[0]?.replace(/^['"]|['"]$/g, '');
    return token && !token.startsWith('-') && !/[;&|]/.test(token) ? token : undefined;
}

function resourceOf(path: string, command: string, end: number): SkillResource | undefined {
    if (!path) {
        return undefined;
    }
    const parts = path.split('/').filter(Boolean);
    const file = parts.at(-1) ?? path;
    if (parts[0] === 'scripts') {
        return { kind: 'script', path, folder: 'scripts', name: file, subcommand: subcommandAfter(command, end) };
    }
    return { kind: 'doc', path, folder: parts.length > 1 ? parts[0]! : null, name: file.replace(/\.md$/, '') };
}

/** Every skill file or script a call touched, in order, without repeating the same one. */
function skillsFromCommands(commands: string[]): SkillTag[] {
    const tags: SkillTag[] = [];
    const seen = new Set<string>();
    for (const command of commands) {
        for (const match of command.matchAll(SKILL_PATH_PATTERN)) {
            const name = match[1] ?? match[3]!;
            const path = match[2] ?? match[4] ?? '';
            const resource = resourceOf(path, command, (match.index ?? 0) + match[0].length);
            const key = `${name}:${resource?.path ?? ''}:${resource?.subcommand ?? ''}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            tags.push({ name, use: resource?.kind === 'script' ? 'script' : 'leu', resource });
        }
    }
    return tags;
}

export function tagEvent(event: SessionEvent): EventTags {
    if (event.kind === 'spawn') {
        return { agent: { direction: 'delegated', peer: event.agent ?? null } };
    }
    if (event.kind === 'agent-message') {
        return { agent: { direction: 'received', peer: event.from ?? null } };
    }
    if (event.name && SEND_TOOLS.has(event.name)) {
        const target = event.text?.match(TARGET_PATTERN)?.[1] ?? event.commands?.[0] ?? null;
        return { agent: { direction: 'sent', peer: target } };
    }
    if (event.kind === 'context') {
        const injected = event.text?.match(INJECTED_SKILL_PATTERN)?.[1];
        if (!injected) {
            return {};
        }
        const skill: SkillTag = { name: injected.trim(), use: 'carregada' };
        return { skill, skills: [skill] };
    }
    if (event.kind !== 'tool' && event.kind !== 'action') {
        return {};
    }
    if (event.name === 'Skill') {
        const skill: SkillTag = { name: event.commands?.[0] ?? '?', use: 'invocada' };
        return { skill, skills: [skill] };
    }
    const mcp = mcpTag(event.name);
    if (mcp) {
        return { mcp };
    }
    const skills = skillsFromCommands(event.commands ?? []);
    return skills.length ? { skill: skills[0], skills } : {};
}

export const SKILL_USE_LABELS: Record<SkillUse, string> = {
    invocada: 'invocou',
    carregada: 'carregou',
    leu: 'leu',
    script: 'rodou script',
};
