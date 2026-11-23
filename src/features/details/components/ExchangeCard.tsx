import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatClock, type NameOf } from '@/features/activity/itemPresentation';
import { cn } from '@/lib/utils';
import type { Exchange, Said } from '../../../../server/conversation';

const TITLES: Record<Exchange['kind'], string> = { spawn: 'Delegação', message: 'Mensagem', return: 'Volta' };

function SaidBlock({ label, said, sessionStart }: { label: string; said: Said | null; sessionStart: number }) {
    const [isOpen, setIsOpen] = useState(false);
    if (!said) {
        return null;
    }
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{label}</span>
                <span className="tabular-nums">
                    {said.evidence === 'inferido' ? 'inferido, ' : ''}em {formatClock(said.at - sessionStart)}
                </span>
            </div>
            <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', !isOpen && 'line-clamp-4')}>{said.text}</p>
            {said.text.length > 280 && (
                <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? 'Mostrar menos' : 'Mostrar tudo'}
                </button>
            )}
        </div>
    );
}

/** One arrow of the flow told as a conversation: who asked what, how the other reacted, what came back. */
export function ExchangeCard({ exchange, nameOf, sessionStart }: { exchange: Exchange; nameOf: NameOf; sessionStart: number }) {
    const from = nameOf(exchange.fromSessionId);
    const to = nameOf(exchange.toSessionId);
    const isEncrypted = exchange.request?.evidence !== 'mensagem' && exchange.kind !== 'return';

    return (
        <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                    {TITLES[exchange.kind]}: {from} → {to}
                </span>
                {exchange.messageType && <Badge variant="outline">{exchange.messageType}</Badge>}
            </div>
            <SaidBlock label={exchange.kind === 'spawn' && !isEncrypted ? `${from} pediu` : `${from} disse antes de enviar`} said={exchange.request} sessionStart={sessionStart} />
            <SaidBlock label={`${to} disse ao receber`} said={exchange.reaction} sessionStart={sessionStart} />
            <SaidBlock label={exchange.kind === 'return' ? `${from} entregou` : `${to} entregou ao terminar`} said={exchange.delivered} sessionStart={sessionStart} />
            {isEncrypted && <p className="text-xs text-muted-foreground">O texto da mensagem vem criptografado; os trechos acima são o que cada agente disse em volta dela.</p>}
        </div>
    );
}
