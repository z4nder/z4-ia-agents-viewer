import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useThemeStore, type ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const LABELS: Record<ThemePreference, string> = { system: 'Tema do sistema', light: 'Tema claro', dark: 'Tema escuro' };
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** Cycles system → light → dark. */
export function ThemeToggle() {
    const preference = useThemeStore((state) => state.preference);
    const setPreference = useThemeStore((state) => state.setPreference);
    const Icon = ICONS[preference];

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={LABELS[preference]} onClick={() => setPreference(NEXT[preference])}>
                    <Icon />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{LABELS[preference]}</TooltipContent>
        </Tooltip>
    );
}
