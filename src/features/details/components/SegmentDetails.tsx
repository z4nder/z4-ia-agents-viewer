import { useMemo } from 'react';
import { CodeBlock, Section } from '@/components/detail';
import { Stat } from '@/components/Stat';
import { Badge } from '@/components/ui/badge';
import { type NameOf } from '@/features/activity/itemPresentation';
import { formatDuration, formatTokens } from '@/lib/format';
import { buildActivity } from '../../../../server/activity';
import type { ProcessResult, Segment } from '../../../../server/analysis';
import type { Session } from '../../../../server/model';
import { ItemList } from './ItemList';

const KIND_LABELS: Record<Segment['kind'], string> = { waiting: 'Bloco de espera', process: 'Processo longo', tool: 'Chamada de ferramenta' };
const RESULT_LABELS: Record<ProcessResult, string> = { passed: 'Passou', failed: 'Falhou', inconclusive: 'Inconclusivo' };

/** A stretch of the timeline and everything the agent did inside it. */
export function SegmentDetails({ segment, session, sessionStart, nameOf }: { segment: Segment; session: Session; sessionStart: number; nameOf: NameOf }) {
    const items = useMemo(
        () => buildActivity(session).filter((item) => item.at !== null && item.at >= segment.start - 500 && item.at <= segment.end + 500),
        [session, segment],
    );

    return (
        <div className="space-y-5">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {KIND_LABELS[segment.kind]}
                    {segment.result && <Badge variant="outline">{RESULT_LABELS[segment.result]}</Badge>}
                </div>
                <CodeBlock label={segment.kind === 'waiting' ? 'Consultas' : 'Comando'}>{segment.label}</CodeBlock>
            </header>
            <div className="grid grid-cols-3 gap-3">
                <Stat value={formatDuration(segment.end - segment.start)} label="duração" />
                {segment.kind !== 'tool' && <Stat value={String(segment.calls)} label="chamadas" />}
                {segment.kind !== 'tool' && <Stat value={formatTokens(segment.tokens)} label="tokens" />}
            </div>
            {items.length > 0 && (
                <Section title="O que aconteceu nesse trecho">
                    <ItemList items={items} sessionId={session.id} startedAt={sessionStart} nameOf={nameOf} />
                </Section>
            )}
        </div>
    );
}
