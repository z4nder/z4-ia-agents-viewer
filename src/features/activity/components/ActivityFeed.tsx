import { ChevronDown, ChevronRight, CornerDownRight, FileText, Hourglass, Mail, MessageSquare, Terminal, User, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildAgentNames } from '@/lib/agentNames';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SKILL_USE_LABELS } from '../../../../server/classify';
import { buildActivity, summarizeActivity, type ActivityItem, type ActivityKind } from '../../../../server/activity';
import type { Session } from '../../../../server/model';

type Filter = 'all' | 'messages' | 'agents' | 'commands' | 'mcp' | 'skills' | 'failures' | 'context';

const FILTERS: [Filter, string][] = [
    ['all', 'Tudo'],
    ['messages', 'Mensagens'],
    ['agents', 'Entre agentes'],
    ['commands', 'Comandos'],
    ['mcp', 'MCP'],
    ['skills', 'Skills'],
    ['failures', 'Falhas'],
    ['context', 'Contexto'],
];

const ICONS: Record<ActivityKind, LucideIcon> = {
    prompt: User,
    context: FileText,
    reply: MessageSquare,
    tool: Terminal,
    spawn: CornerDownRight,
    waiting: Hourglass,
    message: Mail,
};

function matches(item: ActivityItem, filter: Filter): boolean {
    switch (filter) {
        case 'all':
            return item.kind !== 'context' || Boolean(item.tags?.skill);
        case 'messages':
            return item.kind === 'prompt' || item.kind === 'reply' || item.kind === 'spawn' || item.kind === 'message';
        case 'commands':
            return item.kind === 'tool';
        case 'agents':
            return Boolean(item.tags?.agent || item.waitsForAgent);
        case 'mcp':
            return Boolean(item.tags?.mcp);
        case 'skills':
            return Boolean(item.tags?.skill);
        case 'failures':
            return item.ok === false;
        case 'context':
            return item.kind === 'context';
    }
}

/** Time since the session started, precise enough to order events: 4:05, 1:02:47. */
function formatClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

function flatten(session: Session, depth = 0): { session: Session; depth: number }[] {
    return [{ session, depth }, ...session.children.flatMap((child) => flatten(child, depth + 1))];
}

function SummaryBlock({ label, text, note }: { label: string; text: string | null; note?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    if (!text) {
        return null;
    }
    return (
        <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', !isOpen && 'line-clamp-3')}>{text}</p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {text.length > 240 && (
                <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? 'Mostrar menos' : 'Mostrar tudo'}
                </button>
            )}
        </div>
    );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{children}</pre>
        </div>
    );
}

const AGENT_BADGE_CLASS = 'border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';

/** Plain sentence for agent-to-agent items: who sent what to whom. */
function rowTitle(item: ActivityItem, nameOf: (peer: string | null | undefined) => string): string {
    if (item.kind === 'waiting') {
        const polls = item.polls === 1 ? '1 consulta' : `${item.polls} consultas`;
        return `${item.waitsForAgent ? 'Esperando outro agente' : 'Esperando'} ${formatDuration((item.seconds ?? 0) * 1000)} em ${polls} (${item.detail})`;
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

function AgentBadge({ item, nameOf }: { item: ActivityItem; nameOf: (peer: string | null | undefined) => string }) {
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

function ActivityRow({ item, startedAt, nameOf, onOpenChild }: { item: ActivityItem; startedAt: number; nameOf: (peer: string | null | undefined) => string; onOpenChild: (id: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const Icon = ICONS[item.kind];
    const canExpand = item.kind !== 'message' && Boolean(item.detail || item.output);
    const isText = item.kind === 'reply' || item.kind === 'prompt';

    return (
        <li className={cn('border-b', item.kind === 'waiting' && 'bg-amber-500/5')}>
            <button className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left', canExpand && 'hover:bg-accent/60')} onClick={() => canExpand && setIsOpen(!isOpen)} aria-expanded={isOpen}>
                <span className="w-14 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{item.at ? formatClock(item.at - startedAt) : ''}</span>
                <Icon className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground', item.kind === 'waiting' && 'text-amber-500', item.ok === false && 'text-destructive')} />
                <span className={cn('min-w-0 flex-1 text-sm', item.kind === 'tool' && 'font-mono text-xs leading-5', item.kind === 'context' && !item.tags?.skill && 'text-muted-foreground', !isOpen && 'line-clamp-2')}>
                    {rowTitle(item, nameOf)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
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
                    {item.kind === 'tool' && item.seconds !== undefined && item.seconds >= 1 && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(item.seconds * 1000)}</span>}
                    {item.ok === false && <Badge variant="destructive">falhou</Badge>}
                    {canExpand && (isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />)}
                </span>
            </button>
            {isOpen && (
                <div className="space-y-3 pr-4 pb-3 pl-[6.75rem]">
                    {item.detail && (isText ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.detail}</p> : <Block label={item.kind === 'spawn' ? 'Tarefa' : 'Comando'}>{item.detail}</Block>)}
                    {item.output && <Block label="Saída">{item.output}</Block>}
                </div>
            )}
            {item.kind === 'spawn' && item.childId && (
                <div className="pb-2.5 pl-[6.75rem]">
                    <Button variant="outline" size="xs" onClick={() => onOpenChild(item.childId!)}>
                        Ver o que o subagente fez
                    </Button>
                </div>
            )}
        </li>
    );
}

/** What the selected agent did, in order, with each command and output one click away. */
export function ActivityFeed() {
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const select = useSessionStore((state) => state.select);
    const session = findSession(root, selectedId) ?? root;
    const [filter, setFilter] = useState<Filter>('all');
    const activity = useMemo(() => (session ? buildActivity(session) : []), [session]);
    const summary = useMemo(() => (session && root ? summarizeActivity(session, root) : null), [session, root]);

    if (!root || !session || !summary) {
        return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Escolha uma sessão na lista para ver o que cada agente fez.</p>;
    }

    const visible = activity.filter((item) => matches(item, filter));
    const startedAt = session.startedAt ? Date.parse(session.startedAt) : 0;
    const agents = flatten(root);
    const nameOf = buildAgentNames(root);
    const counts: Partial<Record<Filter, number>> = {
        agents: activity.filter((item) => matches(item, 'agents')).length,
        mcp: activity.filter((item) => item.tags?.mcp).length,
        skills: activity.filter((item) => item.tags?.skill).length,
        failures: activity.filter((item) => item.ok === false).length,
    };

    return (
        <div className="flex h-full flex-col">
            <div className="space-y-4 border-b px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={session.id} onValueChange={(id) => select(id)}>
                        <SelectTrigger size="sm" className="min-w-56">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map(({ session: agent, depth }) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    <span style={{ paddingLeft: depth * 12 }}>{agent.nickname ? `${agent.role} (${agent.nickname})` : agent.role}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(value) => value && setFilter(value as Filter)}>
                        {FILTERS.map(([value, label]) => (
                            <ToggleGroupItem key={value} value={value}>
                                {label}
                                {counts[value] !== undefined && (
                                    <span className={cn('tabular-nums', value === 'failures' && counts[value] ? 'text-destructive' : 'text-muted-foreground')}>{counts[value]}</span>
                                )}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <SummaryBlock
                        label="Recebeu"
                        text={summary.request}
                        note={session.tool === 'codex' && session.parentId ? 'O Codex grava o briefing do líder criptografado; só o nome da tarefa fica legível.' : undefined}
                    />
                    <SummaryBlock label="Começou dizendo" text={summary.plan} />
                    <SummaryBlock label="Terminou dizendo" text={summary.result} />
                </div>
            </div>
            <ol className="min-h-0 flex-1 overflow-y-auto">
                {visible.map((item) => (
                    <ActivityRow key={item.id} item={item} startedAt={startedAt} nameOf={nameOf} onOpenChild={(id) => select(id)} />
                ))}
                {visible.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nada com esse filtro.</li>}
            </ol>
        </div>
    );
}
