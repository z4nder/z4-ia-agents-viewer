import { ChartGantt, ListOrdered, Network, Workflow, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useSessionStore, type SessionView } from '@/features/session-tree/store/sessionStore';
import { cn } from '@/lib/utils';

export const VIEWS: { view: SessionView; label: string; description: string; icon: LucideIcon }[] = [
    { view: 'tree', label: 'Árvore', description: 'Quem criou quem, com tokens, chamadas e duração de cada agente.', icon: Network },
    { view: 'timeline', label: 'Linha do tempo', description: 'Quando cada agente trabalhou, esperou ou rodou processos longos.', icon: ChartGantt },
    { view: 'flow', label: 'Fluxo', description: 'A sequência de ações e as delegações, mensagens e voltas entre agentes.', icon: Workflow },
    { view: 'activity', label: 'Atividade', description: 'Tudo o que um agente fez, em ordem, com filtros.', icon: ListOrdered },
];

/** Keys 1 to 4 switch views anywhere outside a text field. */
export function useViewShortcuts(): void {
    const setView = useSessionStore((state) => state.setView);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const isTyping = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
            if (event.metaKey || event.ctrlKey || event.altKey || isTyping) {
                return;
            }
            const view = VIEWS[Number(event.key) - 1]?.view;
            if (view) {
                setView(view);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setView]);
}

export function ViewsPanel() {
    const view = useSessionStore((state) => state.view);
    const setView = useSessionStore((state) => state.setView);

    return (
        <div className="space-y-2 p-3">
            {VIEWS.map(({ view: value, label, description, icon: Icon }, index) => (
                <button
                    key={value}
                    className={cn('flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent', view === value && 'border-foreground/30 bg-accent')}
                    onClick={() => setView(value)}
                    aria-pressed={view === value}
                >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            {label}
                            <kbd className="rounded border px-1.5 text-[10px] font-normal text-muted-foreground">{index + 1}</kbd>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}
