import { cn } from '@/lib/utils';

/** A number with its label underneath; numbers use tabular figures so columns line up. */
export function Stat({ value, label, className }: { value: string; label: string; className?: string }) {
    return (
        <div className={cn('min-w-0', className)}>
            <div className="truncate text-lg leading-tight font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}
