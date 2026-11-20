import type { Session } from '../../../server/model';

export const NODE_WIDTH = 272;
export const NODE_HEIGHT = 124;
const COLUMN_GAP = 40;
const ROW_GAP = 72;

export interface PlacedNode {
    session: Session;
    x: number;
    y: number;
    parent: PlacedNode | null;
}

/** Leader on top, children below; each leaf takes one column and a parent sits centered over its children. */
export function layoutTree(root: Session): PlacedNode[] {
    const placed: PlacedNode[] = [];
    let nextColumn = 0;

    function place(session: Session, depth: number, parent: PlacedNode | null): PlacedNode {
        const node: PlacedNode = { session, x: 0, y: depth * (NODE_HEIGHT + ROW_GAP), parent };
        placed.push(node);
        const children = session.children.map((child) => place(child, depth + 1, node));
        if (children.length === 0) {
            node.x = nextColumn * (NODE_WIDTH + COLUMN_GAP);
            nextColumn += 1;
        } else {
            node.x = (children[0]!.x + children[children.length - 1]!.x) / 2;
        }
        return node;
    }

    place(root, 0, null);
    return placed;
}
