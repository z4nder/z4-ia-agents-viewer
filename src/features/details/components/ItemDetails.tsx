import { CodeBlock, Prose, Row, Section } from '@/components/detail';
import { Stat } from '@/components/Stat';
import { Button } from '@/components/ui/button';
import { formatClock, ICONS, ItemBadges, rowTitle, type NameOf } from '@/features/activity/itemPresentation';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { formatDuration, formatTokens } from '@/lib/format';
import { cn } from '@/lib/utils';
import { callsBetween } from '../../../../server/analysis';
import type { ActivityItem } from '../../../../server/activity';
import type { Session } from '../../../../server/model';

const KIND_LABELS: Record<ActivityItem['kind'], string> = {
    prompt: 'Pedido',
    context: 'Contexto injetado',
    reply: 'Resposta do agente',
    tool: 'Chamada de ferramenta',
    spawn: 'Delegação',
    waiting: 'Espera',
    message: 'Mensagem entre agentes',
};

/** One activity item in full: what it was, when, how long, and its whole text, command and output. */
export function ItemDetails({ item, session, sessionStart, nameOf }: { item: ActivityItem; session: Session; sessionStart: number; nameOf: NameOf }) {
    const selectAgent = useSessionStore((state) => state.selectAgent);
    const Icon = ICONS[item.kind];
    const end = (item.at ?? 0) + (item.seconds ?? 0) * 1000;
    const spent = item.at && item.seconds ? callsBetween(session, item.at, end) : null;
    const isText = item.kind === 'reply' || item.kind === 'prompt' || item.kind === 'context';

    return (
        <div className="space-y-5">
            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="size-4" />
                    {KIND_LABELS[item.kind]}
                    {item.at && <span className="ml-auto tabular-nums">em {formatClock(item.at - sessionStart)}</span>}
                </div>
                <h2 className={cn('text-base leading-snug font-semibold break-words', isText && 'line-clamp-2')}>{rowTitle(item, nameOf)}</h2>
                <div className="flex flex-wrap gap-1.5">
                    <ItemBadges item={item} nameOf={nameOf} />
                </div>
            </header>

            {(item.seconds !== undefined || spent) && (
                <div className="grid grid-cols-3 gap-3">
                    {item.seconds !== undefined && <Stat value={formatDuration(item.seconds * 1000)} label="duração" />}
                    {spent && <Stat value={String(spent.calls)} label="chamadas no meio" />}
                    {spent && <Stat value={formatTokens(spent.tokens)} label="tokens no meio" />}
                </div>
            )}

            {item.kind === 'waiting' && (
                <Section title="Espera">
                    <Row label="Consultas juntadas" value={item.polls ?? 1} />
                    <Row label="Ferramentas de espera" value={item.detail ?? ''} />
                    <Row label="Esperava outro agente" value={item.waitsForAgent ? 'sim' : 'não'} />
                </Section>
            )}

            {item.kind === 'spawn' && (
                <Section title="Delegação">
                    {item.detail && <Prose label="Tarefa">{item.detail}</Prose>}
                    {item.childId && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => selectAgent(item.childId!)}>
                            Ver o subagente
                        </Button>
                    )}
                </Section>
            )}

            {item.kind === 'message' && <p className="text-sm text-muted-foreground">O conteúdo das mensagens entre agentes do Codex vem criptografado; ficam legíveis quem mandou, para quem e quando.</p>}

            {item.detail && item.kind !== 'spawn' && item.kind !== 'waiting' && item.kind !== 'message' && (isText ? <Prose label="Texto completo">{item.detail}</Prose> : <CodeBlock label="Comando">{item.detail}</CodeBlock>)}
            {item.output && <CodeBlock label={item.ok === false ? 'Saída (falhou)' : 'Saída'}>{item.output}</CodeBlock>}
        </div>
    );
}
