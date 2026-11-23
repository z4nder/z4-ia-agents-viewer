import { Clock3, Coins, Cpu, MessageSquare, Users, type LucideIcon } from 'lucide-react';
import type { SessionSummary } from '../../../../server/model';
import { Badge } from '@/components/ui/badge';
import { formatDuration, formatTokens } from '@/lib/format';
import { SOURCE_BADGE_CLASSES, SOURCE_LABELS } from '@/lib/toolColors';
import { cn } from '@/lib/utils';
import { projectOf } from '../sessionFilters';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const numberFormat = new Intl.NumberFormat('pt-BR');

function Metric({ icon: Icon, label, value, title }: { icon: LucideIcon; label: string; value: string; title: string }) {
    return (
        <div title={title}>
            <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="size-3" aria-hidden="true" />{label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
        </div>
    );
}

export function SessionCard({ session, selected, onOpen }: { session: SessionSummary; selected: boolean; onOpen: () => void }) {
    return (
        <button
            className={cn(
                'relative block w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'border-sky-600 bg-sky-50/60 dark:border-sky-400 dark:bg-sky-950/25',
            )}
            aria-current={selected ? 'true' : undefined}
            onClick={onOpen}
        >
            <span className="mb-2 flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className={cn('shrink-0 border-0 text-[10px]', SOURCE_BADGE_CLASSES[session.source])}>{SOURCE_LABELS[session.source]}</Badge>
                <span className="truncate text-xs text-muted-foreground" title={session.cwd ?? undefined}>{projectOf(session)}</span>
                {selected && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-sky-600 dark:bg-sky-400" aria-hidden="true" />}
            </span>
            <span className="line-clamp-2 text-sm leading-snug font-medium">{session.title || 'Sessão sem título'}</span>
            <span className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Cpu className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5" aria-label="Modelos usados">
                    {session.models.length ? session.models.map((model) => <span key={model} className="break-all">{model}</span>) : <span>Modelo não informado</span>}
                </span>
            </span>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-2.5">
                <Metric icon={Users} label="Agentes" value={numberFormat.format(session.agentCount)} title="Líder e todos os subagentes" />
                <Metric icon={MessageSquare} label="Chamadas" value={formatTokens(session.callCount)} title={`${numberFormat.format(session.callCount)} chamadas ao modelo, incluindo subagentes`} />
                <Metric icon={Coins} label="Tokens totais" value={formatTokens(session.totalTokens)} title={`${numberFormat.format(session.totalTokens)} tokens, incluindo subagentes e cache`} />
                <Metric icon={Clock3} label="Duração total" value={session.durationMs === null ? 'Não informada' : formatDuration(session.durationMs)} title="Do primeiro início ao último evento; agentes em paralelo não são somados" />
            </dl>
            <span className="mt-2.5 block text-right text-[10px] tabular-nums text-muted-foreground">
                Atualizada <time dateTime={session.updatedAt} title={new Date(session.updatedAt).toLocaleString('pt-BR')}>{dateFormat.format(new Date(session.updatedAt))}</time>
            </span>
        </button>
    );
}
