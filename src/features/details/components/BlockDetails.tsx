import { Section } from '@/components/detail';
import { Stat } from '@/components/Stat';
import { Button } from '@/components/ui/button';
import { type NameOf } from '@/features/activity/itemPresentation';
import { blockCounts, blockTitle } from '@/features/flow/blockText';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { formatClock } from '@/features/activity/itemPresentation';
import { formatDuration, formatTokens } from '@/lib/format';
import { callsBetween } from '../../../../server/analysis';
import type { FlowBlock, FlowEdgeKind } from '../../../../server/flow';
import { buildSkillUsage } from '../../../../server/skills';
import { sessionInsights } from '../sessionInsights';
import { ExchangeCard } from './ExchangeCard';
import { SkillUsageList } from './SkillUsageList';
import type { Session } from '../../../../server/model';
import { ItemDetails } from './ItemDetails';
import { ItemList } from './ItemList';

const KIND_LABELS: Record<FlowBlock['kind'], string> = {
    work: 'Trabalho',
    waiting: 'Espera',
    spawn: 'Delegação',
    send: 'Mensagem enviada',
    receive: 'Mensagem recebida',
};

const EDGE_LABELS: Record<FlowEdgeKind, { outgoing: string; incoming: string }> = {
    spawn: { outgoing: 'Criou', incoming: 'Criado por' },
    message: { outgoing: 'Recebida por', incoming: 'Enviada por' },
    return: { outgoing: 'Voltou para', incoming: 'Retomou depois de' },
};

/** A block of the flow: its time span, what it cost, the arrows in and out, and its items. */
export function BlockDetails({ block, root, session, nameOf }: { block: FlowBlock; root: Session; session: Session; nameOf: NameOf }) {
    const select = useSessionStore((state) => state.select);
    const { flow, exchanges } = sessionInsights(root);
    const blockById = new Map(flow.blocks.map((candidate) => [candidate.id, candidate]));
    const blockExchanges = exchanges.get(block.id) ?? [];
    const skillUsage = buildSkillUsage(block.items);
    const links = flow.edges.flatMap((edge) => {
        if (edge.fromBlock === block.id) {
            return [{ label: EDGE_LABELS[edge.kind].outgoing, other: blockById.get(edge.toBlock) }];
        }
        if (edge.toBlock === block.id) {
            return [{ label: EDGE_LABELS[edge.kind].incoming, other: blockById.get(edge.fromBlock) }];
        }
        return [];
    });
    const rootStart = root.startedAt ? Date.parse(root.startedAt) : 0;
    const spent = callsBetween(session, block.start, block.end);

    if (block.kind !== 'work' && block.items.length === 1 && links.length === 0) {
        return <ItemDetails item={block.items[0]!} session={session} sessionStart={rootStart} nameOf={nameOf} />;
    }

    return (
        <div className="space-y-5">
            <header className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {KIND_LABELS[block.kind]}
                    <span className="ml-auto tabular-nums">
                        {formatClock(block.start - rootStart)} até {formatClock(block.end - rootStart)}
                    </span>
                </div>
                <h2 className="text-base leading-snug font-semibold break-words">{blockTitle(block, nameOf)}</h2>
                {block.kind === 'work' && <p className="text-sm text-muted-foreground">{blockCounts(block)}</p>}
            </header>

            <div className="grid grid-cols-3 gap-3">
                <Stat value={formatDuration(block.end - block.start)} label="duração" />
                <Stat value={String(spent.calls)} label="chamadas" />
                <Stat value={formatTokens(spent.tokens)} label="tokens" />
            </div>

            {blockExchanges.map((exchange, index) => (
                <ExchangeCard key={index} exchange={exchange} nameOf={nameOf} sessionStart={rootStart} />
            ))}

            {skillUsage.length > 0 && (
                <Section title="Skills usadas aqui">
                    <SkillUsageList usages={skillUsage} items={block.items} sessionId={block.sessionId} sessionStart={rootStart} />
                </Section>
            )}

            {links.length > 0 && (
                <Section title="Ir para a outra ponta">
                    <ul className="space-y-2">
                        {links.map(({ label, other }, index) =>
                            other ? (
                                <li key={index} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="min-w-0">
                                        <span className="text-muted-foreground">{label} </span>
                                        <span className="font-medium">{nameOf(other.sessionId)}</span>
                                        <span className="text-muted-foreground tabular-nums"> em {formatClock(other.start - rootStart)}</span>
                                    </span>
                                    <Button variant="outline" size="xs" onClick={() => select({ type: 'block', sessionId: other.sessionId, block: other })}>
                                        Ir
                                    </Button>
                                </li>
                            ) : null,
                        )}
                    </ul>
                </Section>
            )}

            <Section title={block.items.length === 1 ? 'Item' : `${block.items.length} itens`}>
                <ItemList items={block.items} sessionId={block.sessionId} startedAt={rootStart} nameOf={nameOf} />
            </Section>
        </div>
    );
}
