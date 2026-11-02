import { XIcon } from "lucide-react"

import { isFilterActive, type FilterSchema, type FilterValues } from "@/components/data-table/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const describe = (filter: FilterSchema, values: FilterValues) => {
  const unit = filter.unit ? ` ${filter.unit}` : ""
  switch (filter.type) {
    case "range":
    case "money_range": {
      const [min, max] = filter.params.map((param) => values[param])
      return min && max ? `${min}–${max}${unit}` : min ? `od ${min}${unit}` : `do ${max}${unit}`
    }
    case "select":
      return filter.options?.find((option) => option.value === values[filter.key])?.label ?? values[filter.key]
    default:
      return values[filter.key]
  }
}

// Aktywne filtry jako chipy z „×” i przycisk czyszczenia wszystkich.
export function FilterChips({
  schema,
  values,
  onRemove,
  onClear,
}: {
  schema: FilterSchema[]
  values: FilterValues
  onRemove: (params: string[]) => void
  onClear: () => void
}) {
  const active = schema.filter((filter) => isFilterActive(filter, values))
  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((filter) => {
        const label = `${filter.label}: ${describe(filter, values)}`
        return (
          <Badge key={filter.key} variant="secondary" className="h-6 gap-1 pr-1 font-normal">
            {label}
            <button type="button" aria-label={`Usuń filtr ${label}`} className="hover:bg-foreground/10 rounded-sm p-0.5" onClick={() => onRemove(filter.params)}>
              <XIcon className="size-3" />
            </button>
          </Badge>
        )
      })}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
        Wyczyść filtry
      </Button>
    </div>
  )
}
