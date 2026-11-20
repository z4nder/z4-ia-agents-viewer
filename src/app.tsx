import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionDetails } from '@/features/session-tree/components/SessionDetails';
import { SessionTree } from '@/features/session-tree/components/SessionTree';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import './index.css';

function App() {
    const [file, setFile] = useState('');
    const load = useSessionStore((state) => state.load);
    const error = useSessionStore((state) => state.error);

    return (
        <div className="flex h-full flex-col text-stone-900">
            <form
                className="flex gap-2 border-b border-stone-200 bg-white p-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    void load(file);
                }}
            >
                <input
                    className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 font-mono text-sm"
                    placeholder="Caminho do .jsonl da sessão (Claude ou Codex)"
                    value={file}
                    onChange={(event) => setFile(event.target.value)}
                />
                <button className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white">Abrir</button>
            </form>
            {error && <p className="bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <main className="flex min-h-0 flex-1">
                <div className="min-w-0 flex-1">
                    <SessionTree />
                </div>
                <aside className="w-80 overflow-y-auto border-l border-stone-200 bg-white">
                    <SessionDetails />
                </aside>
            </main>
        </div>
    );
}

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
