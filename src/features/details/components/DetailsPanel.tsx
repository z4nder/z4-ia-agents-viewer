import { ChevronLeft } from 'lucide-react';
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
        return <p className="p-4 text-sm text-muted-foreground">Abra uma sessão e clique em qualquer agente, bloco ou item para ver os detalhes aqui.</p>;
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
