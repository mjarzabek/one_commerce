// Schemat filtrów przysyłany z serwera (np. Inventory::ProductSearch::FILTERS).
// Nowy filtr po stronie serwera pojawia się w panelu i w chipach bez zmian we frontendzie.
export type FilterSchema = {
  key: string
  label: string
  type: "text" | "select" | "range" | "money_range"
  params: string[]
  options?: { value: string; label: string }[]
  unit?: string
}

// Wartości parametrów filtrów: { sku: "LENA", price_min: "99,90", … }.
export type FilterValues = Record<string, string>

export const emptyFilterValues = (schema: FilterSchema[]): FilterValues =>
  Object.fromEntries(schema.flatMap((filter) => filter.params.map((param) => [param, ""])))

export const isFilterActive = (filter: FilterSchema, values: FilterValues) => filter.params.some((param) => !!values[param])

export const activeFilterCount = (schema: FilterSchema[], values: FilterValues) =>
  schema.filter((filter) => isFilterActive(filter, values)).length
