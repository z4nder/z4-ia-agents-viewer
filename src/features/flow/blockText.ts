import type { ActivityItem } from '../../../server/activity';
import type { FlowBlock } from '../../../server/flow';
import { describeSkillUse } from '@/features/activity/itemPresentation';
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

/** Skills used in a block, scripts first ("demo-pr: abrir"), then skills only read; empty when none. */
export function blockSkills(block: FlowBlock): string {
    const tags = block.items.flatMap((item) => item.tags?.skills ?? []);
    const scripts = [...new Set(tags.filter((tag) => tag.resource?.kind === 'script').map(describeSkillUse))];
    const readOnly = [...new Set(tags.map((tag) => tag.name))].filter((name) => !scripts.some((script) => script.startsWith(`${name}:`)));
    return [...scripts, ...readOnly.map((name) => `leu ${name}`)].join(', ');
}
