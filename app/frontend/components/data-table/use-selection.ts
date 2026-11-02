import { useState } from "react"

// Zaznaczanie wierszy listy (także między stronami). Dwa tryby:
// - zwykły: `ids` to zaznaczone wiersze,
// - „wszystkie pasujące” (`allMatching`): zaznaczone jest wszystko, a `ids` to wiersze odznaczone ręcznie.
export function useSelection() {
  const [ids, setIds] = useState<Set<number>>(() => new Set())
  const [allMatching, setAllMatching] = useState(false)

  const isSelected = (id: number) => allMatching !== ids.has(id)

  const setPage = (changeIds: number[], selected: boolean) =>
    setIds((current) => {
      const next = new Set(current)
      changeIds.forEach((id) => (selected !== allMatching ? next.add(id) : next.delete(id)))
      return next
    })

  const toggle = (id: number) => setPage([id], !isSelected(id))

  const selectAll = () => {
    setIds(new Set())
    setAllMatching(true)
  }

  const clear = () => {
    setIds(new Set())
    setAllMatching(false)
  }

  // Liczba zaznaczonych – w trybie „wszystkie” liczona od łącznej liczby pasujących.
  const count = (total: number) => (allMatching ? Math.max(total - ids.size, 0) : ids.size)

  return { ids, allMatching, isSelected, toggle, setPage, selectAll, clear, count }
}

export type Selection = ReturnType<typeof useSelection>
