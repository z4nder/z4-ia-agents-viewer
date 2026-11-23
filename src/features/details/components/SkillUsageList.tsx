import { BookOpen, FileText, Play } from 'lucide-react';
import { formatClock } from '@/features/activity/itemPresentation';
import { useSessionStore } from '@/features/session-tree/store/sessionStore';
import type { ActivityItem } from '../../../../server/activity';
import type { SkillUsage } from '../../../../server/skills';

/** Each skill as what was done with it: loaded, files read, scripts run per subcommand (with failures). */
export function SkillUsageList({ usages, items, sessionId, sessionStart }: { usages: SkillUsage[]; items: ActivityItem[]; sessionId: string; sessionStart: number }) {
    const select = useSessionStore((state) => state.select);
    const open = (itemId: string | undefined) => {
        const item = items.find((candidate) => candidate.id === itemId);
        if (item) {
            select({ type: 'item', sessionId, item });
        }
    };

    return (
        <ul className="space-y-3">
            {usages.map((usage) => (
                <li key={usage.name} className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <span className="size-2 rounded-full bg-fuchsia-500" />
                            {usage.name}
                        </span>
                        {usage.firstAt !== null && <span className="text-xs text-muted-foreground tabular-nums">desde {formatClock(usage.firstAt - sessionStart)}</span>}
                    </div>
                    <ul className="space-y-0.5 text-sm">
                        {usage.loads.map((load) => (
                            <li key={load.itemId}>
                                <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-accent" onClick={() => open(load.itemId)}>
                                    <BookOpen className="size-3.5 text-muted-foreground" />
                                    {load.use === 'invocada' ? 'Invocou a skill' : 'Carregou a skill'}
                                </button>
                            </li>
                        ))}
                        {usage.scripts.map((script) => (
                            <li key={`${script.script}:${script.subcommand}`}>
                                <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-accent" onClick={() => open(script.itemIds.at(-1))}>
                                    <Play className="size-3.5 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate">{script.subcommand ?? script.script}</span>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {script.runs}x{script.failures ? `, ${script.failures} ${script.failures === 1 ? 'falha' : 'falhas'}` : ''}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {usage.docs.map((doc) => (
                            <li key={doc.path}>
                                <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-muted-foreground hover:bg-accent" onClick={() => open(doc.itemIds[0])}>
                                    <FileText className="size-3.5" />
                                    <span className="min-w-0 flex-1 truncate">Leu {doc.folder ? `${doc.folder}/${doc.name}` : doc.name}</span>
                                    {doc.reads > 1 && <span className="text-xs tabular-nums">{doc.reads}x</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
        </ul>
    );
}
