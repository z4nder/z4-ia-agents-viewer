import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NumericRange, SessionFilters } from '../sessionFilters';

const ALL = '__all__';
const SOURCES = [
    { value: 'all', label: 'Todas as ferramentas' },
    { value: 'claude', label: 'Claude' },
    { value: 'codex', label: 'Codex pessoal' },
    { value: 'codex-empresa', label: 'Codex empresa' },
    { value: 'gravada', label: 'Gravadas' },
];

function FilterSelect({ label, value, options, onChange }: {
    label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
    return (
        <div className="min-w-0 space-y-1">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full text-xs" aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

function RangeFilter({ label, value, onChange, step = 1 }: { label: string; value: NumericRange; onChange: (value: NumericRange) => void; step?: number }) {
    const invalid = value.min !== '' && value.max !== '' && Number(value.min) > Number(value.max);
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_82px_82px] items-center gap-2">
            <span className="text-xs">{label}</span>
            <Input type="number" min="0" step={step} placeholder="Mín." value={value.min} aria-label={`${label}: mínimo`} aria-invalid={invalid || undefined}
                className="h-7 text-xs tabular-nums" onChange={(event) => onChange({ ...value, min: event.target.value })} />
            <Input type="number" min="0" step={step} placeholder="Máx." value={value.max} aria-label={`${label}: máximo`} aria-invalid={invalid || undefined}
                className="h-7 text-xs tabular-nums" onChange={(event) => onChange({ ...value, max: event.target.value })} />
        </div>
    );
}

export function SessionFiltersPanel({ filters, projects, models, onChange }: {
    filters: SessionFilters; projects: string[]; models: string[]; onChange: (filters: Partial<SessionFilters>) => void;
}) {
    const invalidRange = [filters.agents, filters.calls, filters.tokens, filters.duration]
        .some((range) => range.min !== '' && range.max !== '' && Number(range.min) > Number(range.max));
    return (
        <div id="session-filters" className="space-y-3 border-b bg-background/40 px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
                <FilterSelect label="Ferramenta" value={filters.source} options={SOURCES} onChange={(value) => onChange({ source: value as SessionFilters['source'] })} />
                <FilterSelect label="Projeto" value={filters.project || ALL} options={[{ value: ALL, label: 'Todos os projetos' }, ...projects.map((value) => ({ value, label: value }))]}
                    onChange={(value) => onChange({ project: value === ALL ? '' : value })} />
            </div>
            <FilterSelect label="Modelo usado" value={filters.model || ALL} options={[{ value: ALL, label: 'Todos os modelos' }, ...models.map((value) => ({ value, label: value }))]}
                onChange={(value) => onChange({ model: value === ALL ? '' : value })} />
            <fieldset className="space-y-1.5">
                <legend className="mb-1 text-[11px] text-muted-foreground">Atualizada no período</legend>
                <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[11px] text-muted-foreground">De
                        <Input type="date" className="mt-1 text-xs" value={filters.from} max={filters.to || undefined} onChange={(event) => onChange({ from: event.target.value })} />
                    </label>
                    <label className="space-y-1 text-[11px] text-muted-foreground">Até
                        <Input type="date" className="mt-1 text-xs" value={filters.to} min={filters.from || undefined} onChange={(event) => onChange({ to: event.target.value })} />
                    </label>
                </div>
            </fieldset>
            <fieldset className="space-y-2 border-t pt-3">
                <legend className="sr-only">Faixas das métricas da sessão inteira</legend>
                <RangeFilter label="Agentes" value={filters.agents} onChange={(agents) => onChange({ agents })} />
                <RangeFilter label="Chamadas" value={filters.calls} onChange={(calls) => onChange({ calls })} />
                <RangeFilter label="Tokens" value={filters.tokens} onChange={(tokens) => onChange({ tokens })} />
                <RangeFilter label="Duração (min)" value={filters.duration} step={0.1} onChange={(duration) => onChange({ duration })} />
                <p className="text-[10px] leading-relaxed text-muted-foreground">Totais incluem o líder e os subagentes. Deixe um limite vazio para não restringir esse lado.</p>
                {invalidRange && <p role="status" className="text-xs text-destructive">O mínimo deve ser menor ou igual ao máximo.</p>}
            </fieldset>
        </div>
    );
}
