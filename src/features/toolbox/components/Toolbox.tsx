import { Info, LayoutDashboard, List, PanelLeftClose, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DetailsPanel } from '@/features/details/components/DetailsPanel';
import { SessionList } from '@/features/session-list/components/SessionList';
import { cn } from '@/lib/utils';
import { useToolboxStore, type ToolPanel } from '../store/toolboxStore';
import { ViewsPanel } from './ViewsPanel';

const TOOLS: { panel: ToolPanel; label: string; icon: LucideIcon }[] = [
    { panel: 'sessions', label: 'Sessões', icon: List },
    { panel: 'details', label: 'Detalhes', icon: Info },
    { panel: 'views', label: 'Visualização', icon: LayoutDashboard },
];

/** Icon rail that is always visible, plus the panel of the open tool. Clicking the open tool collapses it. */
export function Toolbox() {
    const panel = useToolboxStore((state) => state.panel);
    const isOpen = useToolboxStore((state) => state.isOpen);
    const hasUnseenDetails = useToolboxStore((state) => state.hasUnseenDetails);
    const toggle = useToolboxStore((state) => state.toggle);
    const current = TOOLS.find((tool) => tool.panel === panel)!;

    return (
        <div className="flex h-full shrink-0 border-r bg-sidebar text-sidebar-foreground">
            <nav className="flex w-12 flex-col items-center gap-1 border-r py-2" aria-label="Ferramentas">
                {TOOLS.map(({ panel: value, label, icon: Icon }) => {
                    const isActive = isOpen && panel === value;
                    return (
                        <Tooltip key={value}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label={label} aria-pressed={isActive} className={cn('relative', isActive && 'bg-accent text-accent-foreground')} onClick={() => toggle(value)}>
                                    <Icon />
                                    {value === 'details' && hasUnseenDetails && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-500" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">{label}</TooltipContent>
                        </Tooltip>
                    );
                })}
                <div className="mt-auto">
                    <ThemeToggle />
                </div>
            </nav>
            {isOpen && (
                <div className={cn('flex max-w-[calc(100vw-3rem)] flex-col', panel === 'sessions' ? 'w-[380px]' : 'w-[340px]')}>
                    <div className="flex h-11 shrink-0 items-center justify-between border-b pr-1.5 pl-3">
                        <h2 className="text-sm font-semibold">{current.label}</h2>
                        <Button variant="ghost" size="icon-sm" aria-label="Recolher painel" title="Recolher painel" onClick={() => toggle(panel)}>
                            <PanelLeftClose />
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {panel === 'sessions' && <SessionList />}
                        {panel === 'details' && <DetailsPanel />}
                        {panel === 'views' && <ViewsPanel />}
                    </div>
                </div>
            )}
        </div>
    );
}
