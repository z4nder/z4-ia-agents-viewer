import { ChevronLeft, MousePointer2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { findSession, useSessionStore } from '@/features/session-tree/store/sessionStore';
import { buildAgentNames } from '@/lib/agentNames';
import { AgentDetails } from './AgentDetails';
import { BlockDetails } from './BlockDetails';
import { ItemDetails } from './ItemDetails';
import { SegmentDetails } from './SegmentDetails';

/** Follows the last click in any view: an agent, a timeline stretch, a flow block or an activity item. */
export function DetailsPanel() {
    const root = useSessionStore((state) => state.root);
    const selection = useSessionStore((state) => state.selection);
    const selectAgent = useSessionStore((state) => state.selectAgent);
    const nameOf = useMemo(() => (root ? buildAgentNames(root) : () => ''), [root]);
    const session = findSession(root, selection?.sessionId ?? null);
    const sessionStart = root?.startedAt ? Date.parse(root.startedAt) : 0;

    if (!root || !selection || !session) {
        return (
            <div className="flex h-full flex-col items-center justify-center px-7 py-12 text-center">
                <MousePointer2 className="mb-4 size-7 stroke-1 text-muted-foreground/60" aria-hidden="true" />
                <h3 className="text-sm font-medium">Detalhes da seleção</h3>
                <p className="mt-2 max-w-64 text-xs leading-relaxed text-muted-foreground">Selecione um agente, trecho ou evento. Os detalhes acompanham sua seleção em qualquer visualização.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            {selection.type !== 'agent' && (
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => selectAgent(session.id)}>
                    <ChevronLeft />
                    {session.nickname ? `${session.role} (${session.nickname})` : session.role}
                </Button>
            )}
            {selection.type === 'agent' && <AgentDetails sessionId={session.id} />}
            {selection.type === 'item' && <ItemDetails item={selection.item} session={session} sessionStart={sessionStart} nameOf={nameOf} />}
            {selection.type === 'block' && <BlockDetails block={selection.block} root={root} session={session} nameOf={nameOf} />}
            {selection.type === 'segment' && <SegmentDetails segment={selection.segment} session={session} sessionStart={sessionStart} nameOf={nameOf} />}
        </div>
    );
}
