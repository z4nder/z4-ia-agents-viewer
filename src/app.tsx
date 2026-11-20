import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { FlowView } from '@/features/flow/components/FlowView';
import { SessionTree } from '@/features/session-tree/components/SessionTree';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { Timeline } from '@/features/timeline/components/Timeline';
import { Toolbox } from '@/features/toolbox/components/Toolbox';
import { useViewShortcuts, VIEWS } from '@/features/toolbox/components/ViewsPanel';
import { TOOL_LABELS } from '@/lib/toolColors';
import './index.css';

const startFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function App() {
    const view = useSessionStore((state) => state.view);
    const setView = useSessionStore((state) => state.setView);
    const error = useSessionStore((state) => state.error);
    const root = useSessionStore((state) => state.root);
    useViewShortcuts();

    useEffect(() => {
        // Deep link: ?file=<session .jsonl>&view=tree|timeline|flow|activity&agent=<session id>
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        const agent = params.get('agent');
        if (file) {
            void useSessionStore
                .getState()
                .load(file)
                .then(() => agent && useSessionStore.getState().selectAgent(agent, false));
        }
        const initialView = VIEWS.find((candidate) => candidate.view === params.get('view'))?.view;
        if (initialView) {
            setView(initialView);
        }
    }, [setView]);

    const currentView = VIEWS.find((candidate) => candidate.view === view)!;

    return (
        <div className="flex h-full">
            <Toolbox />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
                    <currentView.icon className="size-4 shrink-0 text-muted-foreground" aria-label={currentView.label} />
                    <div className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold">{root ? (root.title ?? 'Sessão sem título') : 'Sessões de agentes'}</span>
                        {root && (
                            <span className="ml-2 text-muted-foreground">
                                {[TOOL_LABELS[root.tool], root.cwd?.split('/').at(-1), root.startedAt && startFormat.format(new Date(root.startedAt))].filter(Boolean).join(', ')}
                            </span>
                        )}
                    </div>
                </header>
                {error && <p className="bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
                <main className="min-h-0 flex-1">
                    {view === 'tree' && <SessionTree />}
                    {view === 'timeline' && <Timeline />}
                    {view === 'flow' && <FlowView />}
                    {view === 'activity' && <ActivityFeed />}
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
