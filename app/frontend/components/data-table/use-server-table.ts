import { router } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"

import type { PaginationState } from "@/components/data-table/pagination"
import { activeFilterCount, emptyFilterValues, type FilterSchema, type FilterValues } from "@/components/data-table/types"
import { useSelection } from "@/components/data-table/use-selection"

export type Params = Record<string, string | number | null | undefined>
export type SortDir = "asc" | "desc"

// Parametry widoku przysyłane z serwera (np. `view` z kontrolera): wyszukiwanie, sortowanie, liczba na stronę
// i parametry konkretnej listy.
type BaseView = { q?: string; sort?: string; dir?: SortDir; per?: number }

// Po tylu ms oczekiwania na serwer tabela przygasa - szybkie odpowiedzi nie migają.
const LOADING_DELAY = 150

type Options<V extends BaseView> = {
  url: string
  view: V
  // Brak, dopóki serwer nie dośle listy (deferred props) - wtedy tabela pokazuje skeleton.
  pagination: PaginationState | undefined
  filterSchema?: FilterSchema[]
  filters?: FilterValues
}

// Stan listy trzymany w adresie i liczony przez serwer: wyszukiwanie (z opóźnieniem), filtry, sortowanie, paginacja,
// zaznaczenie (także „wszystkie pasujące”) i `loading` - czekamy na odpowiedź po zmianie (tabela przygasa).
// Sposób wyświetlania (np. sortowanie, liczbę na stronę) zapamiętuje serwer.
export function useServerTable<V extends BaseView>({ url, view, pagination, filterSchema = [], filters = {} }: Options<V>) {
  const [query, setQuery] = useState(view.q ?? "")
  const selection = useSelection()
  const loading = useDelayedLoading()

  // Aktualne parametry listy - te same trafiają do akcji na „wszystkich pasujących”.
  const listParams = (): Params => ({ ...filters, ...view, q: query, per: pagination?.per ?? view.per })

  // Domyślnie zmiana wraca na 1. stronę i czyści zaznaczenie (wyszukiwanie, filtry, katalog).
  // `reset: false` - zostaje bieżąca strona i zaznaczenie (sortowanie, paginacja, zmiana kolumny ceny/stanu).
  const visit = (changes: Params, { reset = true } = {}) => {
    const values: Params = { ...listParams(), page: reset ? 1 : (pagination?.page ?? 1), ...changes }
    const params = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v != null)) as Record<string, string | number>
    if (reset) selection.clear()
    router.get(url, params, { preserveState: true, preserveScroll: true, replace: true, onStart: loading.start, onFinish: loading.finish })
  }

  // Wyszukiwanie w trakcie pisania (z opóźnieniem).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (query === (view.q ?? "")) return
    const timeout = setTimeout(() => visit({ q: query }), 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const filtered = !!view.q || activeFilterCount(filterSchema, filters) > 0

  return {
    view,
    pagination,
    filterSchema,
    filters,
    selection,
    loading: loading.active,
    query,
    setQuery,
    visit,
    listParams,
    filtered,
    sort: {
      field: view.sort,
      dir: view.dir,
      set: (field: string, dir: SortDir) => visit({ sort: field, dir }, { reset: false }),
    },
    goToPage: (page: number) => visit({ page }, { reset: false }),
    setPer: (per: number) => visit({ per, page: 1 }, { reset: false }),
    clearAll: () => {
      setQuery("")
      visit({ ...emptyFilterValues(filterSchema), q: "" })
    },
    // Parametry akcji masowej: zaznaczone `ids` albo „wszystkie pasujące” (parametry listy) bez odznaczonych.
    bulkParams: (operation: Record<string, string>) =>
      selection.allMatching
        ? { ...listParams(), ...operation, all: "true", excluded_ids: [...selection.ids] }
        : { ...operation, ids: [...selection.ids] },
  }
}

export type ServerTable = ReturnType<typeof useServerTable>

// `active` włącza się dopiero po LOADING_DELAY od startu wizyty. Nowa wizyta anuluje poprzednią - liczy się ostatnia
// (zakończenie anulowanej nie gasi przygaszenia nowej).
function useDelayedLoading() {
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const current = useRef<object>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  return {
    active,
    start: (visit: object) => {
      current.current = visit
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setActive(true), LOADING_DELAY)
    },
    finish: (visit: object) => {
      if (visit !== current.current) return
      clearTimeout(timer.current)
      setActive(false)
    },
  }
}
