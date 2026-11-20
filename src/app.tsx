import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionList } from '@/features/session-list/components/SessionList';
import { SessionDetails } from '@/features/session-tree/components/SessionDetails';
import { SessionTree } from '@/features/session-tree/components/SessionTree';
import { useSessionStore, type SessionView } from '@/features/session-tree/store/sessionStore';
import { Timeline } from '@/features/timeline/components/Timeline';
import './index.css';

const VIEWS: [SessionView, string][] = [
    ['tree', 'Árvore'],
    ['timeline', 'Linha do tempo'],
];

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
        <div className="flex h-full text-stone-900">
            <aside className="w-80 shrink-0 border-r border-stone-200 bg-white">
                <SessionList />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-3 py-2">
                    <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{root ? (root.title ?? root.id) : 'Sessões de agentes'}</h1>
                    <div className="flex rounded-md border border-stone-300 p-0.5 text-xs">
                        {VIEWS.map(([value, label]) => (
                            <button key={value} className={`rounded px-3 py-1 ${view === value ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'}`} onClick={() => setView(value)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </header>
                {error && <p className="bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <main className="flex min-h-0 flex-1">
                    <div className="min-w-0 flex-1">{view === 'tree' ? <SessionTree /> : <Timeline />}</div>
                    <aside className="w-80 shrink-0 overflow-y-auto border-l border-stone-200 bg-white">
                        <SessionDetails />
                    </aside>
                </main>
            </div>
        </div>
    );
}

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
