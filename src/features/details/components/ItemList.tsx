import { formatClock, ICONS, isRawCommand, rowTitle, type NameOf } from '@/features/activity/itemPresentation';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '../../../../server/activity';

/** Compact list of activity items; clicking one opens it in the details panel. */
export function ItemList({ items, sessionId, startedAt, nameOf }: { items: ActivityItem[]; sessionId: string; startedAt: number; nameOf: NameOf }) {
    const select = useSessionStore((state) => state.select);
    return (
        <ul className="-mx-2">
            {items.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                    <li key={item.id}>
                        <button className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent" onClick={() => select({ type: 'item', sessionId, item })}>
                            <span className="w-11 shrink-0 pt-px text-right text-xs text-muted-foreground tabular-nums">{item.at ? formatClock(item.at - startedAt) : ''}</span>
                            <Icon className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground', item.ok === false && 'text-destructive')} />
                            <span className={cn('min-w-0 flex-1 line-clamp-2 text-xs', isRawCommand(item) && 'font-mono')}>{rowTitle(item, nameOf)}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
