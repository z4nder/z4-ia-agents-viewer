/**
 * Tags MCP and skill usage on events. Pure functions shared with the web.
 *
 * MCP: Claude names tools `mcp__<server>__<tool>`; Codex calls `tools.<server>__<tool>` from exec.
 * Skills: Claude has a `Skill` tool; Codex has none, so a skill shows up as context injected when it is
 * invoked (`<skill><name>…</name>`), reading its SKILL.md/playbooks, or running its scripts.
 */

import type { SessionEvent } from './model';

export type SkillUse = 'invocada' | 'carregada' | 'leu' | 'script';

export interface McpTag {
    server: string;
    tool: string;
}

export interface SkillTag {
    name: string;
    use: SkillUse;
}

export interface EventTags {
    mcp?: McpTag;
    skill?: SkillTag;
}

const CLAUDE_MCP_PATTERN = /^mcp__(.+?)__(.+)$/;
const CODEX_MCP_PATTERN = /^([a-z0-9-]+)__([a-z0-9_]+)$/i;
const INJECTED_SKILL_PATTERN = /<skill>\s*<name>([^<]+)<\/name>/;
/** ~/.codex/skills/<name>/… or a Nix store skill: /nix/store/<hash>-<name>/SKILL.md */
const SKILL_PATH_PATTERN = /\/skills\/([\w.-]+)\/([\w./-]*)|\/nix\/store\/[a-z0-9]{32}-([\w.-]+)\/((?:SKILL\.md|playbooks|scripts)[\w./-]*)/;

function mcpTag(name: string | undefined): McpTag | undefined {
    if (!name) {
        return undefined;
    }
    const match = name.match(CLAUDE_MCP_PATTERN) ?? name.match(CODEX_MCP_PATTERN);
    return match ? { server: match[1]!, tool: match[2]! } : undefined;
}

function skillFromCommands(commands: string[]): SkillTag | undefined {
    for (const command of commands) {
        const match = command.match(SKILL_PATH_PATTERN);
        if (match) {
            const name = match[1] ?? match[3]!;
            const rest = match[2] ?? match[4] ?? '';
            return { name, use: rest.startsWith('scripts/') ? 'script' : 'leu' };
        }
    }
    return undefined;
}

export function tagEvent(event: SessionEvent): EventTags {
    if (event.kind === 'context') {
        const injected = event.text?.match(INJECTED_SKILL_PATTERN)?.[1];
        return injected ? { skill: { name: injected.trim(), use: 'carregada' } } : {};
    }
    if (event.kind !== 'tool' && event.kind !== 'action') {
        return {};
    }
    if (event.name === 'Skill') {
        return { skill: { name: event.commands?.[0] ?? '?', use: 'invocada' } };
    }
    const mcp = mcpTag(event.name);
    if (mcp) {
        return { mcp };
    }
    const skill = skillFromCommands(event.commands ?? []);
    return skill ? { skill } : {};
}

export const SKILL_USE_LABELS: Record<SkillUse, string> = {
    invocada: 'invocou',
    carregada: 'carregou',
    leu: 'leu',
    script: 'rodou script',
};
