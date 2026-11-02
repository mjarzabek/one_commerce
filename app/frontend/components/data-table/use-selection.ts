import { useCallback, useState } from "react"

// Zaznaczanie wierszy listy: pojedyncze id (także między stronami) albo „wszystkie pasujące” (wszystkie strony).
export function useSelection() {
  const [ids, setIds] = useState<Set<number>>(() => new Set())
  const [allMatching, setAllMatching] = useState(false)

  const toggle = useCallback((id: number) => {
    setAllMatching(false)
    setIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setPage = useCallback((pageIds: number[], selected: boolean) => {
    setAllMatching(false)
    setIds((current) => {
      const next = new Set(current)
      pageIds.forEach((id) => (selected ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setIds(new Set())
    setAllMatching(false)
  }, [])

  return { ids, allMatching, setAllMatching, toggle, setPage, clear, isSelected: (id: number) => allMatching || ids.has(id) }
}

export type Selection = ReturnType<typeof useSelection>
