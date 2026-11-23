import { LoaderCircle } from 'lucide-react';
import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActivityFeed } from '@/features/activity/components/ActivityFeed';
import { FlowView } from '@/features/flow/components/FlowView';
import { SessionTree } from '@/features/session-tree/components/SessionTree';
import { readSessionNavigation, SESSION_VIEWS } from '@/features/session-tree/store/sessionNavigation';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import { Timeline } from '@/features/timeline/components/Timeline';
import { useViewShortcuts, VIEWS } from '@/features/workspace/components/ViewSwitcher';
import { Workspace, WorkspaceEmptyState } from '@/features/workspace/components/Workspace';
import { TOOL_BADGE_CLASSES, TOOL_LABELS } from '@/lib/toolColors';
import { cn } from '@/lib/utils';
import './index.css';

const startFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

function App() {
    const { view, setView, error, root, isLoading, load, selectAgent } = useSessionStore();
    const restored = useRef(false);
    useViewShortcuts();

    useEffect(() => {
        if (restored.current) return;
        restored.current = true;
        const params = new URLSearchParams(window.location.search);
        const saved = readSessionNavigation();
        const explicitFile = params.get('file');
        const file = explicitFile ?? saved.file;
        const agent = params.get('agent');
        const initialView = VIEWS.find((candidate) => candidate.view === params.get('view'))?.view ?? saved.view;
        setView(initialView);
        if (file) {
            void load(file, explicitFile ? null : saved.selection).then(() => {
                if (agent && useSessionStore.getState().root?.file === file) selectAgent(agent, false);
            });
        }
    }, [load, selectAgent, setView]);

    return (
        <Tabs value={view} onValueChange={(value) => { if (SESSION_VIEWS.includes(value as typeof view)) setView(value as typeof view); }}
            className="h-dvh min-h-0 flex-col gap-0! overflow-hidden">
            <Workspace>
                <div className="flex h-12 shrink-0 items-center gap-2.5 border-b px-4">
                    {root && <Badge variant="secondary" className={cn('shrink-0 border-0 text-[10px]', TOOL_BADGE_CLASSES[root.tool])}>{TOOL_LABELS[root.tool]}</Badge>}
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-xs font-medium" title={root?.title ?? undefined}>{root ? root.title || 'Sessão sem título' : 'Área de trabalho'}</h1>
                        {root && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{[root.cwd?.split('/').at(-1), root.startedAt && startFormat.format(new Date(root.startedAt))].filter(Boolean).join(' · ')}</p>}
                    </div>
                    {isLoading && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Carregando sessão" />}
                </div>
                {error && <p role="alert" className="border-b bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</p>}
                <main className="min-h-0 flex-1">
                    {root ? <>
                        <TabsContent key={`tree:${root.file}`} value="tree" className="h-full min-h-0"><SessionTree /></TabsContent>
                        <TabsContent key={`timeline:${root.file}`} value="timeline" className="h-full min-h-0"><Timeline /></TabsContent>
                        <TabsContent key={`flow:${root.file}`} value="flow" className="h-full min-h-0"><FlowView /></TabsContent>
                        <TabsContent key={`activity:${root.file}`} value="activity" className="h-full min-h-0"><ActivityFeed /></TabsContent>
                    </> : isLoading ? <p role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">Restaurando sessão…</p> : <WorkspaceEmptyState />}
                </main>
            </Workspace>
        </Tabs>
    );
}

createRoot(document.getElementById('app')!).render(<StrictMode><TooltipProvider><App /></TooltipProvider></StrictMode>);
