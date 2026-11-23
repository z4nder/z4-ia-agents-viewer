import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildAgentNames } from '@/lib/agentNames';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { buildActivity, summarizeActivity, type ActivityItem } from '../../../../server/activity';
import type { Session } from '../../../../server/model';
import { groupSkillReading } from '../../../../server/skills';
import { formatClock, ICONS, isRawCommand, ItemBadges, rowTitle, type NameOf } from '../itemPresentation';
import { useRememberedScroll, useSessionViewState } from '@/features/workspace/useSessionViewState';

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

function ActivityRow({ item, startedAt, isSelected, nameOf, onSelect, onOpenChild }: {
    item: ActivityItem;
    startedAt: number;
    isSelected: boolean;
    nameOf: NameOf;
    onSelect: () => void;
    onOpenChild: (id: string) => void;
}) {
    const Icon = ICONS[item.kind];

    return (
        <li className={cn('border-b', item.kind === 'waiting' && 'bg-amber-500/5', isSelected && 'bg-accent')}>
            <button className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-accent/60" onClick={onSelect} aria-pressed={isSelected}>
                <span className="w-14 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">{item.at ? formatClock(item.at - startedAt) : ''}</span>
                <Icon className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground', item.kind === 'waiting' && 'text-amber-500', item.ok === false && 'text-destructive')} />
                <span className={cn('min-w-0 flex-1 line-clamp-2 text-sm', isRawCommand(item) && 'font-mono text-xs leading-5', item.kind === 'context' && !item.tags?.skill && 'text-muted-foreground')}>
                    {rowTitle(item, nameOf)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <ItemBadges item={item} nameOf={nameOf} />
                    {item.kind === 'tool' && item.seconds !== undefined && item.seconds >= 1 && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(item.seconds * 1000)}</span>}
                </span>
            </button>
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

/** What the selected agent did, in order; clicking an item shows it in the right-hand details panel. */
export function ActivityFeed() {
    const root = useSessionStore((state) => state.root);
    const selectedId = useSessionStore((state) => state.selectedId);
    const select = useSessionStore((state) => state.select);
    const selectAgent = useSessionStore((state) => state.selectAgent);
    const selectedItemId = useSessionStore((state) => (state.selection?.type === 'item' ? state.selection.item.id : null));
    const session = findSession(root, selectedId) ?? root;
    const [filter, setFilter] = useSessionViewState<Filter>(root?.file, 'activityFilter', 'all', (value): value is Filter => FILTERS.some(([key]) => key === value));
    const [groupsReading, setGroupsReading] = useSessionViewState(root?.file, 'activityGrouped', true, (value): value is boolean => typeof value === 'boolean');
    const scroll = useRememberedScroll<HTMLOListElement>(root?.file, 'activityScroll', selectedId ?? '');
    const activity = useMemo(() => {
        const items = session ? buildActivity(session) : [];
        return groupsReading ? groupSkillReading(items) : items;
    }, [session, groupsReading]);
    const summary = useMemo(() => (session && root ? summarizeActivity(session, root) : null), [session, root]);

    if (!root || !session || !summary) {
        return <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Escolha uma sessão na lista para ver o que cada agente fez.</p>;
    }

    const visible = activity.filter((item) => matches(item, filter));
    // One clock for the whole session, so times line up across agents.
    const startedAt = root.startedAt ? Date.parse(root.startedAt) : 0;
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
                    <Select value={session.id} onValueChange={(id) => selectAgent(id)}>
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
                    <Toggle size="sm" variant="outline" pressed={groupsReading} onPressedChange={setGroupsReading} title="Junta as leituras seguidas de arquivos de skill numa linha só">
                        Agrupar leituras de skill
                    </Toggle>
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
            <ol {...scroll} className="min-h-0 flex-1 overflow-y-auto">
                {visible.map((item) => (
                    <ActivityRow
                        key={item.id}
                        item={item}
                        startedAt={startedAt}
                        isSelected={item.id === selectedItemId}
                        nameOf={nameOf}
                        onSelect={() => select({ type: 'item', sessionId: session.id, item })}
                        onOpenChild={(id) => selectAgent(id)}
                    />
                ))}
                {visible.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nada com esse filtro.</li>}
            </ol>
        </div>
    );
}
