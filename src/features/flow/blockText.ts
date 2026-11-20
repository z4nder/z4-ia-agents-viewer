import type { ActivityItem } from '../../../server/activity';
import type { FlowBlock } from '../../../server/flow';
import { formatDuration } from '@/lib/format';

/** One line for what happened in a block, in the words the activity feed uses. */
export function blockTitle(block: FlowBlock, nameOf: (peer: string | null | undefined) => string): string {
    const item: ActivityItem = block.items[0]!;
    const peer = nameOf(item.tags?.agent?.peer);
    switch (block.kind) {
        case 'spawn':
            return `Delegou para ${peer}`;
        case 'send':
            return `Enviou mensagem para ${peer}`;
        case 'receive':
            return item.detail === 'terminou' ? `${peer} terminou` : `Recebeu mensagem de ${peer}`;
        case 'waiting':
            return `${item.waitsForAgent ? 'Esperando outro agente' : 'Esperando'} ${formatDuration((item.seconds ?? 0) * 1000)}`;
        case 'work': {
            const reply = block.items.find((candidate) => candidate.kind === 'reply' || candidate.kind === 'prompt');
            return reply?.title ?? block.items[0]?.title ?? '';
        }
    }
}

/** Counts for a work block: replies, commands, failures and how long it took. */
export function blockCounts(block: FlowBlock): string {
    const replies = block.items.filter((item) => item.kind === 'reply').length;
    const commands = block.items.filter((item) => item.kind === 'tool').length;
    const failures = block.items.filter((item) => item.ok === false).length;
    const parts = [
        replies && `${replies} ${replies === 1 ? 'resposta' : 'respostas'}`,
        commands && `${commands} ${commands === 1 ? 'comando' : 'comandos'}`,
        failures && `${failures} ${failures === 1 ? 'falha' : 'falhas'}`,
        block.end > block.start && formatDuration(block.end - block.start),
    ];
    return parts.filter(Boolean).join(', ');
}
