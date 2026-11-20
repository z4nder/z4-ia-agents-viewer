import type { Session } from '../../server/model';

/**
 * Codex messages name agents by address (/root, /root/implementar) or by the last segment
 * (implementar). Maps any of those to the agent's role so the UI can say "demo-julgamento".
 */
export function buildAgentNames(root: Session): (peer: string | null | undefined) => string {
    const names = new Map<string, string>();
    const visit = (session: Session) => {
        if (session.agentPath) {
            names.set(session.agentPath, session.role);
            names.set(session.agentPath.split('/').filter(Boolean).at(-1) ?? session.agentPath, session.role);
        }
        names.set(session.id, session.role);
        session.children.forEach(visit);
    };
    visit(root);
    return (peer) => (peer ? (names.get(peer) ?? peer) : 'outro agente');
}
