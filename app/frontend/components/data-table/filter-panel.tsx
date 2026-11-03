import { ListFilterIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { activeFilterCount, emptyFilterValues, type FilterSchema, type FilterValues } from "@/components/data-table/types"
import { OptionSelect } from "@/components/option-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ANY = "__any"

// Przycisk w pasku narzędzi rozwijający panel filtrów (z liczbą aktywnych filtrów).
export function FilterToggle({ schema, values, open, onToggle }: { schema: FilterSchema[]; values: FilterValues; open: boolean; onToggle: () => void }) {
  const count = activeFilterCount(schema, values)
  return (
    <Button variant={open ? "secondary" : "outline"} aria-expanded={open} aria-controls="filter-panel" onClick={onToggle}>
      <ListFilterIcon />
      Filtry
      {count > 0 && (
        <Badge variant={open ? "outline" : "secondary"} className="ml-0.5 h-5 min-w-5 px-1.5 tabular-nums">
          {count}
        </Badge>
      )}
    </Button>
  )
}

// Ramka pola z etykietą na krawędzi (jak w BaseLinkerze) - gęsto, bez osobnych wierszy na etykiety.
function Framed({ label, htmlFor, children, className }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 relative flex h-9 items-stretch rounded-lg border transition-colors focus-within:ring-3",
        className,
      )}
    >
      {children}
      <label htmlFor={htmlFor} className="bg-card text-muted-foreground pointer-events-none absolute -top-2 left-2 truncate px-1 text-[11px] leading-4">
        {label}
      </label>
    </div>
  )
}

const bare = "h-full w-full min-w-0 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/60"

// Panel filtrów nad tabelą rysowany ze schematu: gęsta siatka pól, Enter = zastosuj.
export function FilterPanel({
  schema,
  values,
  onApply,
  className,
}: {
  schema: FilterSchema[]
  values: FilterValues
  onApply: (values: FilterValues) => void
  className?: string
}) {
  const [draft, setDraft] = useState(values)
  useEffect(() => setDraft(values), [values])
  const set = (param: string, value: string) => setDraft((current) => ({ ...current, [param]: value }))
  const changed = Object.keys({ ...draft, ...values }).some((key) => (draft[key] ?? "") !== (values[key] ?? ""))

  const field = (filter: FilterSchema) => {
    const id = `filter-${filter.key}`
    switch (filter.type) {
      case "range":
      case "money_range": {
        const [min, max] = filter.params
        const numeric = filter.type === "money_range" ? { inputMode: "decimal" as const } : { type: "number", inputMode: "numeric" as const }
        return (
          <Framed key={filter.key} label={`${filter.label} od${filter.unit ? ` (${filter.unit})` : ""}`} htmlFor={`${id}-min`}>
            <input id={`${id}-min`} {...numeric} className={bare} value={draft[min] ?? ""} onChange={(e) => set(min, e.target.value)} />
            <span className="bg-input w-px shrink-0" />
            <label htmlFor={`${id}-max`} className="bg-card text-muted-foreground pointer-events-none absolute -top-2 left-1/2 px-1 text-[11px] leading-4">
              do
            </label>
            <input id={`${id}-max`} {...numeric} className={bare} value={draft[max] ?? ""} onChange={(e) => set(max, e.target.value)} />
          </Framed>
        )
      }
      case "select":
        return (
          <Framed key={filter.key} label={filter.label} htmlFor={id}>
            <OptionSelect
              id={id}
              className="h-full w-full border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              options={[{ value: ANY, label: "Dowolny" }, ...(filter.options ?? [])]}
              value={draft[filter.key] || ANY}
              onChange={(value) => set(filter.key, value === ANY ? "" : value)}
            />
          </Framed>
        )
      default:
        return (
          <Framed key={filter.key} label={filter.label} htmlFor={id}>
            <input id={id} className={bare} value={draft[filter.key] ?? ""} onChange={(e) => set(filter.key, e.target.value)} />
          </Framed>
        )
    }
  }

  return (
    <form
      id="filter-panel"
      aria-label="Filtry"
      className={cn("bg-card flex flex-col gap-3 rounded-xl border p-3 pt-4", className)}
      onSubmit={(e) => {
        e.preventDefault()
        onApply(draft)
      }}
    >
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">{schema.map(field)}</div>
      <div className="flex items-center justify-end gap-2">
        {changed && <span className="text-muted-foreground mr-auto text-xs">Zmiany nie są jeszcze zastosowane - Enter albo „Zastosuj”.</span>}
        <Button type="button" variant="ghost" onClick={() => onApply(emptyFilterValues(schema))}>
          Wyczyść
        </Button>
        <Button type="submit">
          Zastosuj
        </Button>
      </div>
    </form>
  )
}
