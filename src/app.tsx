import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionList } from '@/features/session-list/components/SessionList';
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

    useEffect(() => {
        // Deep link: ?file=<session .jsonl>&view=timeline
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        if (file) {
            void useSessionStore.getState().load(file);
        }
        if (params.get('view') === 'timeline') {
            setView('timeline');
        }
    }, [setView]);

    return (
        <div className="flex h-full">
            <aside className="w-80 shrink-0 border-r bg-sidebar text-sidebar-foreground">
                <SessionList />
            </aside>
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
                        </TabsList>
                    </Tabs>
                    <ThemeToggle />
                </header>
                {error && <p className="bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <main className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1">{view === 'tree' ? <SessionTree /> : <Timeline />}</div>
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
