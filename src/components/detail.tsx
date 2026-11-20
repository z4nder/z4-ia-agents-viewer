import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Building blocks shared by every details view. */

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

export function Row({ label, value, swatch }: { label: string; value: ReactNode; swatch?: string }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                {swatch && <span className={cn('size-2 shrink-0 rounded-full', swatch)} />}
                <span className="truncate">{label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{value}</span>
        </div>
    );
}

export function CodeBlock({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{children}</pre>
        </div>
    );
}

export function Prose({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{children}</p>
        </div>
    );
}
