import type { SessionSource, Tool } from '../../server/model';

/** Codex is teal and Claude violet everywhere; amber is reserved for waiting. */
export const TOOL_LABELS: Record<Tool, string> = { codex: 'Codex', claude: 'Claude' };

export const SOURCE_LABELS: Record<SessionSource, string> = {
    claude: 'Claude',
    codex: 'Codex pessoal',
    'codex-empresa': 'Codex empresa',
    gravada: 'Gravada',
};

export const SOURCE_BADGE_CLASSES: Record<SessionSource, string> = {
    claude: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    codex: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    'codex-empresa': 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    gravada: 'bg-muted text-muted-foreground',
};

export const TOOL_BADGE_CLASSES: Record<Tool, string> = {
    claude: SOURCE_BADGE_CLASSES.claude,
    codex: SOURCE_BADGE_CLASSES.codex,
};
