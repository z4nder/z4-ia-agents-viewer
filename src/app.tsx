import { ChevronsRight } from 'lucide-react';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { FlowView } from '@/features/flow/components/FlowView';
import { SessionList } from '@/features/session-list/components/SessionList';
import { useSessionListStore } from '@/features/session-list/store/sessionListStore';
import { SessionDetails } from '@/features/session-tree/components/SessionDetails';
import { SessionTree } from '@/features/session-tree/components/SessionTree';
import { useSessionStore, type SessionView } from '@/features/session-tree/store/sessionStore';
import { Timeline } from '@/features/timeline/components/Timeline';
import { TOOL_LABELS } from '@/lib/toolColors';
import './index.css';

const startFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function App() {
    const view = useSessionStore((state) => state.view);
    const setView = useSessionStore((state) => state.setView);
    const error = useSessionStore((state) => state.error);
    const root = useSessionStore((state) => state.root);
    const isListCollapsed = useSessionListStore((state) => state.isCollapsed);
    const setListCollapsed = useSessionListStore((state) => state.setCollapsed);

    useEffect(() => {
        // Deep link: ?file=<session .jsonl>&view=timeline|flow|activity&agent=<session id>
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        const agent = params.get('agent');
        if (file) {
            void useSessionStore
                .getState()
                .load(file)
                .then(() => agent && useSessionStore.getState().select(agent));
        }
        const initialView = params.get('view');
        if (initialView === 'timeline' || initialView === 'flow' || initialView === 'activity') {
            setView(initialView);
        }
    }, [setView]);

    return (
        <div className="flex h-full">
            {isListCollapsed ? (
                <aside className="flex w-12 shrink-0 flex-col items-center border-r bg-sidebar py-2.5">
                    <Button variant="ghost" size="icon-sm" aria-label="Mostrar sessões" title="Mostrar sessões" onClick={() => setListCollapsed(false)}>
                        <ChevronsRight />
                    </Button>
                </aside>
            ) : (
                <aside className="w-80 shrink-0 border-r bg-sidebar text-sidebar-foreground">
                    <SessionList />
                </aside>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-3 border-b px-3 py-2">
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-sm font-semibold">{root ? (root.title ?? 'Sessão sem título') : 'Sessões de agentes'}</h1>
                        {root && (
                            <p className="truncate text-xs text-muted-foreground">
                                {[TOOL_LABELS[root.tool], root.cwd?.split('/').at(-1), root.startedAt && startFormat.format(new Date(root.startedAt))].filter(Boolean).join(', ')}
                            </p>
                        )}
                    </div>
                    <Tabs value={view} onValueChange={(value) => setView(value as SessionView)}>
                        <TabsList>
                            <TabsTrigger value="tree">Árvore</TabsTrigger>
                            <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
                            <TabsTrigger value="flow">Fluxo</TabsTrigger>
                            <TabsTrigger value="activity">Atividade</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <ThemeToggle />
                </header>
                {error && <p className="bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <main className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1">
                        {view === 'tree' && <SessionTree />}
                        {view === 'timeline' && <Timeline />}
                        {view === 'flow' && <FlowView />}
                        {view === 'activity' && <ActivityFeed />}
                    </div>
                    <aside className="w-80 shrink-0 overflow-y-auto border-l">
                        <SessionDetails />
                    </aside>
                </main>
            </div>
        </div>
    );
}

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </StrictMode>,
);
