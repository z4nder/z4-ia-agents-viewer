/**
 * Groups an agent's skill touches into one usage per skill: when it was loaded, which files it read and
 * which scripts (with subcommand) it ran, with failures. Built from the activity, so every entry points
 * back to the items that prove it.
 */

import type { ActivityItem } from './activity';

export interface SkillDocUse {
    path: string;
    folder: string | null;
    name: string;
    reads: number;
    firstAt: number | null;
    itemIds: string[];
}

export interface SkillScriptUse {
    script: string;
    subcommand: string | null;
    runs: number;
    failures: number;
    firstAt: number | null;
    itemIds: string[];
}

export interface SkillLoad {
    use: 'carregada' | 'invocada';
    at: number | null;
    itemId: string;
}

export interface SkillUsage {
    name: string;
    firstAt: number | null;
    loads: SkillLoad[];
    docs: SkillDocUse[];
    scripts: SkillScriptUse[];
    /** Items that touched the skill, in order. */
    itemIds: string[];
}

export function buildSkillUsage(items: ActivityItem[]): SkillUsage[] {
    const usages = new Map<string, SkillUsage>();
    for (const item of items) {
        for (const tag of item.tags?.skills ?? []) {
            const usage = usages.get(tag.name) ?? { name: tag.name, firstAt: item.at, loads: [], docs: [], scripts: [], itemIds: [] };
            usages.set(tag.name, usage);
            if (!usage.itemIds.includes(item.id)) {
                usage.itemIds.push(item.id);
            }
            const resource = tag.resource;
            if (tag.use === 'carregada' || tag.use === 'invocada') {
                usage.loads.push({ use: tag.use, at: item.at, itemId: item.id });
            } else if (resource?.kind === 'script') {
                const subcommand = resource.subcommand ?? null;
                let script = usage.scripts.find((candidate) => candidate.script === resource.name && candidate.subcommand === subcommand);
                if (!script) {
                    script = { script: resource.name, subcommand, runs: 0, failures: 0, firstAt: item.at, itemIds: [] };
                    usage.scripts.push(script);
                }
                script.runs += 1;
                script.failures += item.ok === false ? 1 : 0;
                script.itemIds.push(item.id);
            } else if (resource) {
                let doc = usage.docs.find((candidate) => candidate.path === resource.path);
                if (!doc) {
                    doc = { path: resource.path, folder: resource.folder, name: resource.name, reads: 0, firstAt: item.at, itemIds: [] };
                    usage.docs.push(doc);
                }
                doc.reads += 1;
                doc.itemIds.push(item.id);
            }
        }
    }
    return [...usages.values()].sort((a, b) => (a.firstAt ?? 0) - (b.firstAt ?? 0));
}

/** A call that mostly loads or reads skill files and runs no skill script. */
function isSkillReading(item: ActivityItem): boolean {
    const skills = item.tags?.skills ?? [];
    if (skills.length === 0 || skills.some((tag) => tag.use === 'script')) {
        return false;
    }
    if (item.kind === 'context') {
        return true;
    }
    // Parallel reads often carry a `git status` along; most of the commands must still be skill files.
    const commands = item.detail?.split('\n\n').filter(Boolean) ?? [];
    return item.kind === 'tool' && commands.length > 0 && skills.length * 2 >= commands.length;
}

/**
 * Collapses consecutive skill loads and reads into one "skills" item whose children are the original
 * items. Scripts stay as their own rows: they are actions (open a PR, comment an issue), not reading.
 */
export function groupSkillReading(items: ActivityItem[]): ActivityItem[] {
    const grouped: ActivityItem[] = [];
    let run: ActivityItem[] = [];

    const flush = () => {
        if (run.length === 1) {
            grouped.push(run[0]!);
        } else if (run.length > 1) {
            const usage = buildSkillUsage(run);
            const parts = usage.map((skill) => {
                const files = skill.docs.map((doc) => (doc.folder ? `${doc.folder}/${doc.name}` : doc.name));
                const loaded = skill.loads.length ? ['carregou'] : [];
                return `${skill.name} (${[...loaded, ...files].join(', ')})`;
            });
            grouped.push({
                id: `${run[0]!.id}-skills`,
                kind: 'skills',
                at: run[0]!.at,
                title: `Leu skills: ${parts.join('; ')}`,
                children: run,
                tags: { skill: run[0]!.tags?.skill, skills: run.flatMap((item) => item.tags?.skills ?? []) },
            });
        }
        run = [];
    };

    for (const item of items) {
        if (isSkillReading(item)) {
            run.push(item);
        } else {
            flush();
            grouped.push(item);
        }
    }
    flush();
    return grouped;
}
