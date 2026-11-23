import { List, Network, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, ScanEye } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DetailsPanel } from '@/features/details/components/DetailsPanel';
import { SessionList } from '@/features/session-list/components/SessionList';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { cn } from '@/lib/utils';
import { clampDetailsWidth, DETAILS_MAX_WIDTH, useWorkspaceStore } from '../store/workspaceStore';
import { DetailsResizeHandle } from './DetailsResizeHandle';
import { ViewSwitcher } from './ViewSwitcher';
import { useRememberedScroll } from '../useSessionViewState';
import { selectionReference } from '@/features/session-tree/store/sessionNavigation';

function PanelHeader({ side, onClose }: { side: 'sessions' | 'details'; onClose: () => void }) {
    const selection = useSessionStore((state) => state.selection);
    const Icon = side === 'sessions' ? List : ScanEye;
    const Close = side === 'sessions' ? PanelLeftClose : PanelRightClose;
    const label = side === 'sessions' ? 'Sessões' : 'Detalhes';
    const kind = selection?.type === 'agent' ? 'Agente' : selection?.type === 'item' ? 'Atividade' : selection?.type === 'block' ? 'Bloco' : 'Trecho';
    return (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xs font-semibold">{label}</h2>
            {side === 'details' && selection && <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{kind}</span>}
            <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Recolher ${label.toLowerCase()}`} title={`Recolher ${label.toLowerCase()}`} onClick={onClose}><Close /></Button>
        </div>
    );
}

const SessionsContent = memo(function SessionsContent() {
    return <div className="min-h-0 flex-1 overflow-y-auto"><SessionList /></div>;
});

const DetailsContent = memo(function DetailsContent() {
    const selection = useSessionStore((state) => state.selection);
    const file = useSessionStore((state) => state.root?.file);
    const scroll = useRememberedScroll<HTMLDivElement>(file, 'detailsScroll', JSON.stringify(selectionReference(selection)));
    const acknowledge = useWorkspaceStore((state) => state.acknowledgeDetails);
    useEffect(() => { acknowledge(); }, [selection, acknowledge]);
    return <div {...scroll} className="min-h-0 flex-1 overflow-auto"><DetailsPanel /></div>;
});

export function Workspace({ children }: { children: ReactNode }) {
    const { sessionsOpen, detailsOpen, detailsWidth, mobilePanel, hasUnseenDetails, toggleSessions, toggleDetails, setDetailsWidth, setMobilePanel } = useWorkspaceStore();
    const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
    const [width, setWidth] = useState(window.innerWidth);
    const container = useRef<HTMLDivElement>(null);
    const lastMobilePanel = useRef<'sessions' | 'details'>('sessions');

    useEffect(() => { if (mobilePanel) lastMobilePanel.current = mobilePanel; }, [mobilePanel]);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 1023px)');
        const update = () => { setCompact(media.matches); setMobilePanel(null); };
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, [setMobilePanel]);

    useLayoutEffect(() => {
        if (!container.current) return;
        const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
        observer.observe(container.current);
        return () => observer.disconnect();
    }, []);

    const leftVisible = compact ? mobilePanel === 'sessions' : sessionsOpen;
    const rightVisible = compact ? mobilePanel === 'details' : detailsOpen;
    const leftWidth = width >= 1280 ? 360 : 320;
    const maxDetailsWidth = Math.max(280, Math.min(DETAILS_MAX_WIDTH, width - (sessionsOpen ? leftWidth : 0) - 320));
    const actualDetailsWidth = clampDetailsWidth(detailsWidth, maxDetailsWidth);
    const toggleLeft = () => compact ? setMobilePanel(leftVisible ? null : 'sessions') : toggleSessions();
    const toggleRight = () => compact ? setMobilePanel(rightVisible ? null : 'details') : toggleDetails();

    return (
        <>
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-background px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                    <Button id="toggle-sessions" variant={leftVisible ? 'secondary' : 'ghost'} size="sm" className="h-9 gap-2" aria-controls="workspace-sessions" aria-expanded={leftVisible} onClick={toggleLeft}>
                        <PanelLeft /><span>Sessões</span>
                    </Button>
                    <span className="hidden items-center gap-2 border-l pl-3 text-sm font-semibold lg:flex"><Network className="size-4 text-muted-foreground" aria-hidden="true" />Agentes</span>
                </div>
                <ViewSwitcher />
                <div className="flex items-center gap-2">
                    <Button id="toggle-details" variant={rightVisible ? 'secondary' : 'ghost'} size="sm" className="relative h-9 gap-2" aria-controls="workspace-details" aria-expanded={rightVisible} onClick={toggleRight}>
                        <PanelRight /><span>Detalhes</span>
                        {hasUnseenDetails && !rightVisible && <span className="size-1.5 rounded-full bg-sky-500" aria-label="Nova seleção" />}
                    </Button>
                    <span className="border-l pl-1"><ThemeToggle /></span>
                </div>
            </header>
            <div ref={container} className="relative flex min-h-0 flex-1">
                {!compact && sessionsOpen && (
                    <aside id="workspace-sessions" aria-label="Sessões" className="flex w-80 shrink-0 flex-col border-r bg-sidebar xl:w-[360px]">
                        <PanelHeader side="sessions" onClose={toggleSessions} />
                        <SessionsContent />
                    </aside>
                )}
                <section className="flex min-w-0 flex-1 flex-col" aria-label="Área de visualização">{children}</section>
                {!compact && detailsOpen && (
                    <aside id="workspace-details" aria-label="Detalhes da seleção" className="relative flex shrink-0 flex-col border-l bg-background" style={{ width: actualDetailsWidth }}>
                        <DetailsResizeHandle width={actualDetailsWidth} maxWidth={maxDetailsWidth} onChange={setDetailsWidth} />
                        <PanelHeader side="details" onClose={toggleDetails} />
                        <DetailsContent />
                    </aside>
                )}
            </div>
            {compact && (
                <Dialog.Root open={mobilePanel !== null} onOpenChange={(open) => { if (!open) setMobilePanel(null); }}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
                        <Dialog.Content id={mobilePanel === 'sessions' ? 'workspace-sessions' : 'workspace-details'}
                            className={cn('fixed inset-y-0 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col bg-background shadow-xl outline-none', mobilePanel === 'sessions' ? 'left-0 border-r' : 'right-0 border-l')}
                            onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById(lastMobilePanel.current === 'sessions' ? 'toggle-sessions' : 'toggle-details')?.focus(); }}>
                            <Dialog.Title className="sr-only">{mobilePanel === 'sessions' ? 'Sessões' : 'Detalhes da seleção'}</Dialog.Title>
                            <Dialog.Description className="sr-only">{mobilePanel === 'sessions' ? 'Escolha uma sessão para explorar.' : 'Informações sobre o agente ou evento selecionado.'}</Dialog.Description>
                            <PanelHeader side={mobilePanel ?? 'sessions'} onClose={() => setMobilePanel(null)} />
                            {mobilePanel === 'sessions' ? <SessionsContent /> : <DetailsContent />}
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            )}
        </>
    );
}

export function WorkspaceEmptyState() {
    const showSessions = () => {
        const state = useWorkspaceStore.getState();
        if (window.matchMedia('(max-width: 1023px)').matches) state.setMobilePanel('sessions');
        else if (!state.sessionsOpen) state.toggleSessions();
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="Buscar pelo nome da sessão"]')?.focus());
    };
    return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Network className="mb-5 size-10 stroke-1 text-muted-foreground/60" aria-hidden="true" />
            <h1 className="text-base font-semibold">Abra uma sessão</h1>
            <p className="mt-2 max-w-72 text-sm leading-relaxed text-muted-foreground">Explore os agentes no centro e acompanhe os detalhes da seleção à direita.</p>
            <Button variant="outline" className="mt-5 gap-2" onClick={showSessions}><List className="size-4" />Escolher sessão</Button>
        </div>
    );
}
