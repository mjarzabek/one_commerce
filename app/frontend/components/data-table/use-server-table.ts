import { router, usePage } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"

import type { PaginationState } from "@/components/data-table/pagination"
import { activeFilterCount, emptyFilterValues, type FilterSchema, type FilterValues } from "@/components/data-table/types"
import { useSelection } from "@/components/data-table/use-selection"
import { usePersistentState } from "@/hooks/use-persistent-state"

export type Params = Record<string, string | number | null | undefined>
export type SortDir = "asc" | "desc"

// Parametry widoku przysyłane z serwera (np. `view` z kontrolera): wyszukiwanie, sortowanie i parametry konkretnej listy.
type BaseView = { q?: string; sort?: string; dir?: SortDir }

type Options<V extends BaseView> = {
  url: string
  view: V
  pagination: PaginationState
  filterSchema?: FilterSchema[]
  filters?: FilterValues
  // Widok zapamiętany w przeglądarce (osobno dla konta). Przy wejściu na listę przywracamy to, czego nie ma w adresie
  // (adres ma pierwszeństwo). `keys` - zapamiętywane parametry (`per` też można), `sanitize` - np. odrzucenie
  // usuniętego katalogu. Wyszukiwania, filtrów i strony nie zapamiętujemy.
  persist?: { key: string; keys: string[]; sanitize?: (saved: Params) => Params }
}

// Stan listy trzymany w adresie i liczony przez serwer: wyszukiwanie (z opóźnieniem), filtry, sortowanie, paginacja,
// zapamiętany widok i zaznaczenie (także „wszystkie pasujące”).
export function useServerTable<V extends BaseView>({ url, view, pagination, filterSchema = [], filters = {}, persist }: Options<V>) {
  const [query, setQuery] = useState(view.q ?? "")
  const selection = useSelection()

  // Aktualne parametry listy - te same trafiają do akcji na „wszystkich pasujących”.
  const listParams = (): Params => ({ ...filters, ...view, q: query, per: pagination.per })

  // Domyślnie zmiana wraca na 1. stronę i czyści zaznaczenie (wyszukiwanie, filtry, katalog).
  // `reset: false` - zostaje bieżąca strona i zaznaczenie (sortowanie, paginacja, zmiana kolumny ceny/stanu).
  const visit = (changes: Params, { reset = true } = {}) => {
    const values: Params = { ...listParams(), page: reset ? 1 : pagination.page, ...changes }
    const params = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v != null)) as Record<string, string | number>
    if (reset) selection.clear()
    router.get(url, params, { preserveState: true, preserveScroll: true, replace: true })
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

  usePersistedView(persist, { ...view, per: pagination.per } as Params, visit)

  const filtered = !!view.q || activeFilterCount(filterSchema, filters) > 0

  return {
    view,
    pagination,
    filterSchema,
    filters,
    selection,
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

function usePersistedView(persist: Options<BaseView>["persist"], current: Params, visit: (changes: Params) => void) {
  const accountId = usePage<{ account: { id: number } | null }>().props.account?.id
  const [saved, save] = usePersistentState<Params | null>(persist ? `${persist.key}:${accountId}` : "", null)
  const keys = persist?.keys ?? []
  const picked = Object.fromEntries(keys.map((key) => [key, current[key]]))
  const restoring = useRef(false)

  useEffect(() => {
    if (!persist || !saved) return
    const url = new URLSearchParams(window.location.search)
    const usable = persist.sanitize ? persist.sanitize(saved) : saved
    const changes = Object.fromEntries(
      Object.entries(usable).filter(([key, value]) => keys.includes(key) && value != null && !url.has(key) && value !== picked[key]),
    )
    if (Object.keys(changes).length === 0) return
    // Zapis poniżej pominie ten render, żeby nie nadpisać zapamiętanego widoku domyślnym przed przywróceniem.
    restoring.current = true
    visit(changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signature = JSON.stringify(picked)
  useEffect(() => {
    if (!persist) return
    if (restoring.current) {
      restoring.current = false
      return
    }
    save(picked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}
