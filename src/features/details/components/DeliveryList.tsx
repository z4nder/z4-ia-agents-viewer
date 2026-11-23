import { ExternalLink, GitCommitHorizontal, GitPullRequest, MessageSquareText, SquareDot, type LucideIcon } from 'lucide-react';
import { describeSkillUse, formatClock, rowTitle, type NameOf } from '@/features/activity/itemPresentation';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildActivity, type ActivityItem } from '../../../../server/activity';
import type { Delivery, DeliveryKind } from '../../../../server/deliveries';

const KINDS: Record<DeliveryKind, { label: string; icon: LucideIcon }> = {
    pr: { label: 'PR', icon: GitPullRequest },
    issue: { label: 'Issue', icon: SquareDot },
    comment: { label: 'Comentário na issue', icon: MessageSquareText },
    commit: { label: 'Commit', icon: GitCommitHorizontal },
};

/** "demo-pr: abrir" for a skill script, the command otherwise. */
function originLabel(item: ActivityItem, nameOf: NameOf): string {
    const script = item.tags?.skills?.find((tag) => tag.resource?.kind === 'script');
    return script ? describeSkillUse(script) : rowTitle(item, nameOf);
}

/** PRs, issues, comments and commits, each with the action that made it (measured or inferred). */
export function DeliveryList({ deliveries, nameOf, sessionStart }: { deliveries: Delivery[]; nameOf: NameOf; sessionStart: number }) {
    const root = useSessionStore((state) => state.root);
    const select = useSessionStore((state) => state.select);

    const originOf = (delivery: Delivery) => {
        const origin = delivery.origin;
        const session = origin && findSession(root, origin.sessionId);
        const item = session && buildActivity(session).find((candidate) => candidate.id === origin.itemId);
        return item && session ? { item, session } : null;
    };

    return (
        <ul className="space-y-2.5">
            {deliveries.map((delivery) => {
                const { label, icon: Icon } = KINDS[delivery.kind];
                const origin = originOf(delivery);
                const number = delivery.ref.split('#')[1];
                return (
                    <li key={`${delivery.kind}:${delivery.ref}:${delivery.url ?? ''}`} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-sm font-medium">
                                    {label} {delivery.kind === 'commit' ? delivery.ref : `#${number}`}
                                    {delivery.url && (
                                        <a href={delivery.url} target="_blank" rel="noreferrer noopener" className="text-muted-foreground hover:text-foreground" aria-label="Abrir no GitHub">
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{delivery.kind === 'commit' ? [delivery.title, delivery.branch].filter(Boolean).join(', ') : delivery.ref.split('#')[0]}</p>
                            </div>
                            {delivery.firstSeen.at !== null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatClock(delivery.firstSeen.at - sessionStart)}</span>}
                        </div>
                        {origin ? (
                            <button className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-accent" onClick={() => select({ type: 'item', sessionId: origin.session.id, item: origin.item })}>
                                <span className="text-muted-foreground">{delivery.origin!.evidence === 'medido' ? 'Feito com ' : 'Provavelmente feito com '}</span>
                                {originLabel(origin.item, nameOf)}
                                {root && origin.session.id !== root.id && <span className="text-muted-foreground"> ({nameOf(origin.session.id)})</span>}
                            </button>
                        ) : (
                            delivery.kind === 'issue' && <p className="px-1 text-xs text-muted-foreground">Citada na sessão</p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
