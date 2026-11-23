import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SOURCE_LABELS } from '@/lib/toolColors';
import { defaultFilters, type NumericRange, type SessionFilters } from '../sessionFilters';

interface FilterChip {
    key: string;
    label: string;
    clear: Partial<SessionFilters>;
}

const numbers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

function rangeLabel(range: NumericRange): string {
    const min = range.min === '' ? '' : numbers.format(Number(range.min));
    const max = range.max === '' ? '' : numbers.format(Number(range.max));
    if (min && max) return Number(range.min) === Number(range.max) ? min : `${min}–${max}`;
    return min ? `≥ ${min}` : `≤ ${max}`;
}

function dateLabel(value: string): string {
    return value.split('-').reverse().join('/');
}

export function ActiveSessionFilters({ filters, onChange, onClearAll }: {
    filters: SessionFilters; onChange: (filters: Partial<SessionFilters>) => void; onClearAll: () => void;
}) {
    const chips: FilterChip[] = [];
    const defaults = defaultFilters();
    if (filters.query.trim()) chips.push({ key: 'query', label: `Busca: “${filters.query.trim()}”`, clear: { query: '' } });
    if (filters.source !== 'all') chips.push({ key: 'source', label: `Ferramenta: ${SOURCE_LABELS[filters.source]}`, clear: { source: 'all' } });
    if (filters.project) chips.push({ key: 'project', label: `Projeto: ${filters.project}`, clear: { project: '' } });
    if (filters.model) chips.push({ key: 'model', label: `Modelo: ${filters.model}`, clear: { model: '' } });
    if (filters.from || filters.to) {
        const period = filters.from && filters.to ? `${dateLabel(filters.from)}–${dateLabel(filters.to)}`
            : filters.from ? `Desde ${dateLabel(filters.from)}` : `Até ${dateLabel(filters.to)}`;
        chips.push({ key: 'period', label: period, clear: { from: '', to: '' } });
    }
    for (const [key, label] of [['agents', 'Agentes'], ['calls', 'Chamadas'], ['tokens', 'Tokens'], ['duration', 'Duração']] as const) {
        if (filters[key].min !== '' || filters[key].max !== '') {
            chips.push({ key, label: `${label}: ${rangeLabel(filters[key])}${key === 'duration' ? ' min' : ''}`, clear: { [key]: defaults[key] } });
        }
    }
    if (!chips.length) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros ativos">
            {chips.map((chip) => (
                <Badge key={chip.key} variant="secondary" className="h-auto min-h-7 max-w-full gap-1 py-0.5 pr-1 text-[11px] font-normal">
                    <span className="min-w-0 truncate" title={chip.label}>{chip.label}</span>
                    <button type="button" aria-label={`Remover filtro ${chip.label}`} title={`Remover filtro ${chip.label}`}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onChange(chip.clear)}><X className="size-3" aria-hidden="true" /></button>
                </Badge>
            ))}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={onClearAll}>Limpar todos</Button>
        </div>
    );
}
