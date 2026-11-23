import { ChartGantt, ListOrdered, Network, Workflow, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionStore, type SessionView } from '@/features/session-tree/store/sessionStore';

export const VIEWS: { view: SessionView; label: string; description: string; icon: LucideIcon }[] = [
    { view: 'tree', label: 'Árvore', description: 'Agentes e suas delegações', icon: Network },
    { view: 'timeline', label: 'Linha do tempo', description: 'Trabalho, esperas e processos de cada agente', icon: ChartGantt },
    { view: 'flow', label: 'Fluxo', description: 'Ações e mensagens entre os agentes', icon: Workflow },
    { view: 'activity', label: 'Atividade', description: 'Mensagens e ferramentas do agente selecionado', icon: ListOrdered },
];

export function useViewShortcuts(): void {
    const setView = useSessionStore((state) => state.setView);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const isTyping = event.target instanceof Element && event.target.closest('input, textarea, select, [role="combobox"], [role="option"], [contenteditable="true"]');
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping) return;
            const view = VIEWS[Number(event.key) - 1]?.view;
            if (view) setView(view);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setView]);
}

export function ViewSwitcher() {
    return (
        <nav className="order-last flex w-full justify-center border-t pt-2 md:order-none md:w-auto md:border-0 md:pt-0" aria-label="Visualização da sessão">
            <TabsList className="h-9! w-full gap-0.5 bg-muted/70 md:w-auto" aria-label="Modo de visualização">
                {VIEWS.map(({ view, label, description, icon: Icon }, index) => (
                    <TabsTrigger key={view} value={view} aria-label={label} className="h-8 gap-1.5 px-1.5 text-[11px] data-active:text-sky-700 sm:text-xs md:px-3 dark:data-active:text-sky-300"
                        title={`${description} (atalho ${index + 1})`}>
                        <Icon className="size-3.5!" aria-hidden="true" />
                        {view === 'timeline' ? <><span className="hidden min-[440px]:inline">{label}</span><span className="min-[440px]:hidden" aria-hidden="true">Tempo</span></> : <span>{label}</span>}
                    </TabsTrigger>
                ))}
            </TabsList>
        </nav>
    );
}
