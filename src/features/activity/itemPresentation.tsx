import { BookOpen, CornerDownRight, FileText, Hourglass, Mail, MessageSquare, Terminal, User, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/format';
import { SKILL_USE_LABELS, type SkillTag } from '../../../server/classify';
import type { ActivityItem, ActivityKind } from '../../../server/activity';

export type NameOf = (peer: string | null | undefined) => string;

export const ICONS: Record<ActivityKind, LucideIcon> = {
    prompt: User,
    context: FileText,
    reply: MessageSquare,
    tool: Terminal,
    spawn: CornerDownRight,
    waiting: Hourglass,
    message: Mail,
    skills: BookOpen,
};

/** A skill file or script in plain words: "demo-issue: comentar", "playbooks/feature". */
export function describeSkillUse(tag: SkillTag): string {
    const resource = tag.resource;
    if (!resource) {
        return `${tag.name} (${SKILL_USE_LABELS[tag.use]})`;
    }
    if (resource.kind === 'script') {
        return `${tag.name}: ${resource.subcommand ?? resource.name}`;
    }
    return resource.folder ? `${resource.folder}/${resource.name}` : resource.name;
}

/**
 * Calls that use a skill read as what they did with it, not as the raw command. Scripts win over reads:
 * "Usou demo-pr: abrir". Reads list the files: "Leu demo-mode: playbooks/feature, SKILL".
 */
function skillTitle(item: ActivityItem): string | null {
    const skills = item.tags?.skills ?? [];
    if (item.kind !== 'tool' || skills.length === 0) {
        return null;
    }
    const scripts = skills.filter((tag) => tag.resource?.kind === 'script');
    if (scripts.length) {
        return `Usou ${scripts.map(describeSkillUse).join(', ')}`;
    }
    const bySkill = new Map<string, string[]>();
    for (const tag of skills) {
        bySkill.set(tag.name, [...(bySkill.get(tag.name) ?? []), describeSkillUse(tag)]);
    }
    return `Leu ${[...bySkill].map(([name, files]) => `${name}: ${files.join(', ')}`).join('; ')}`;
}

/** Time since the session started, precise enough to order events: 4:05, 1:02:47. */
export function formatClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

const AGENT_BADGE_CLASS = 'border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';

/** Raw commands read better in monospace; calls retitled by their skill use don't. */
export function isRawCommand(item: ActivityItem): boolean {
    return item.kind === 'tool' && !item.tags?.skills?.length && !item.title.startsWith('Patch:');
}

/** Plain sentence for agent-to-agent items: who sent what to whom. */
export function rowTitle(item: ActivityItem, nameOf: NameOf): string {
    if (item.kind === 'waiting') {
        const polls = item.polls === 1 ? '1 consulta' : `${item.polls} consultas`;
        return `${item.waitsForAgent ? 'Esperando outro agente' : 'Esperando'} ${formatDuration((item.seconds ?? 0) * 1000)} em ${polls} (${item.detail})`;
    }
    const fromSkill = skillTitle(item);
    if (fromSkill) {
        return fromSkill;
    }
    const agent = item.tags?.agent;
    if (agent?.direction === 'received') {
        return item.detail === 'terminou' ? `${nameOf(agent.peer)} terminou e devolveu o resultado` : `Recebeu mensagem de ${nameOf(agent.peer)}`;
    }
    if (agent?.direction === 'sent') {
        return `Enviou mensagem para ${nameOf(agent.peer)}`;
    }
    return item.title;
}

export function AgentBadge({ item, nameOf }: { item: ActivityItem; nameOf: NameOf }) {
    const agent = item.tags?.agent;
    if (!agent && !item.waitsForAgent) {
        return null;
    }
    const text = !agent ? 'esperando agente' : agent.direction === 'delegated' ? `delegou para ${nameOf(agent.peer)}` : agent.direction === 'sent' ? `para ${nameOf(agent.peer)}` : `de ${nameOf(agent.peer)}`;
    return (
        <Badge variant="secondary" className={AGENT_BADGE_CLASS}>
            {text}
        </Badge>
    );
}

/** Every badge an item can carry: agent talk, MCP server, skill and failure. */
export function ItemBadges({ item, nameOf }: { item: ActivityItem; nameOf: NameOf }) {
    return (
        <>
            <AgentBadge item={item} nameOf={nameOf} />
            {item.tags?.mcp && (
                <Badge variant="secondary" className="border-0 bg-sky-500/15 text-sky-700 dark:text-sky-300" title={`Ferramenta ${item.tags.mcp.tool} do servidor MCP ${item.tags.mcp.server}`}>
                    MCP {item.tags.mcp.server}
                </Badge>
            )}
            {item.tags?.skill && (
                <Badge variant="secondary" className="border-0 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300" title={`${SKILL_USE_LABELS[item.tags.skill.use]} a skill ${item.tags.skill.name}`}>
                    {item.tags.skill.name}
                    <span className="opacity-70">{SKILL_USE_LABELS[item.tags.skill.use]}</span>
                </Badge>
            )}
            {item.ok === false && <Badge variant="destructive">falhou</Badge>}
        </>
    );
}
