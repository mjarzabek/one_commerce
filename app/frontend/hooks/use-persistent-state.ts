import { useState } from "react"

// Stan zapamiętany w przeglądarce (localStorage) - np. czy panel filtrów jest rozwinięty.
// Gdy localStorage jest niedostępny (tryb prywatny, blokada), działa jak zwykły useState.
export function usePersistentState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? fallback : (JSON.parse(stored) as T)
    } catch {
      return fallback
    }
  })

  const update = (next: T) => {
    setValue(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // brak dostępu do localStorage - trudno, stan zostaje tylko w pamięci
    }
  }

  return [value, update]
}
