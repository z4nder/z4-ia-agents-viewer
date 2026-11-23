import { buildExchanges, type Exchange } from '../../../server/conversation';
import { buildDeliveries, type Delivery } from '../../../server/deliveries';
import { buildFlow, type Flow } from '../../../server/flow';
import type { Session } from '../../../server/model';

export interface SessionInsights {
    flow: Flow;
    /** Exchanges by flow block id. */
    exchanges: Map<string, Exchange[]>;
    deliveries: Delivery[];
    /** The flow block that holds each activity item, to find an item's exchange. */
    blockOfItem: Map<string, string>;
}

const cache = new WeakMap<Session, SessionInsights>();

/** Derived data for the open session, computed once per loaded tree. */
export function sessionInsights(root: Session): SessionInsights {
    const cached = cache.get(root);
    if (cached) {
        return cached;
    }
    const flow = buildFlow(root);
    const blockOfItem = new Map(flow.blocks.flatMap((block) => block.items.map((item) => [item.id, block.id] as const)));
    const insights = { flow, exchanges: buildExchanges(root, flow), deliveries: buildDeliveries(root), blockOfItem };
    cache.set(root, insights);
    return insights;
}
