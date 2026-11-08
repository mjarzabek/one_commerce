import { SearchIcon } from "lucide-react"
import type { ReactNode } from "react"

import { FilterChips } from "@/components/data-table/filter-chips"
import { FilterPanel, FilterToggle } from "@/components/data-table/filter-panel"
import { activeFilterCount, emptyFilterValues } from "@/components/data-table/types"
import type { ServerTable } from "@/components/data-table/use-server-table"
import { Input } from "@/components/ui/input"
import { usePersistentState } from "@/hooks/use-persistent-state"

// Pasek nad tabelą: wyszukiwarka, przycisk filtrów i dodatkowe kontrolki po prawej (`children`),
// pod nim panel filtrów albo - gdy zwinięty - chipy aktywnych filtrów.
// `id` - klucz zapamiętania, czy panel filtrów jest rozwinięty.
export function DataTableToolbar({ id, server, searchLabel, children }: { id: string; server: ServerTable; searchLabel: string; children?: ReactNode }) {
  const { filterSchema, filters, visit } = server
  const [filtersOpen, setFiltersOpen] = usePersistentState(`${id}-filters-open`, false)
  const hasFilters = filterSchema.length > 0

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder={`${searchLabel}…`}
            aria-label={searchLabel}
            className="pl-8"
            value={server.query}
            onChange={(e) => server.setQuery(e.target.value)}
          />
        </div>
        {hasFilters && <FilterToggle schema={filterSchema} values={filters} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} />}
        {children && <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-4">{children}</div>}
      </div>

      {hasFilters &&
        (filtersOpen ? (
          <FilterPanel schema={filterSchema} values={filters} onApply={(values) => visit(values)} className="rounded-none border-x-0 border-b-0 px-3 pt-5" />
        ) : (
          activeFilterCount(filterSchema, filters) > 0 && (
            <div className="px-3 pb-3">
              <FilterChips
                schema={filterSchema}
                values={filters}
                onRemove={(params) => visit(Object.fromEntries(params.map((param) => [param, ""])))}
                onClear={() => visit(emptyFilterValues(filterSchema))}
              />
            </div>
          )
        ))}
    </>
  )
}
