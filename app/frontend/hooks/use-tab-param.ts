import { usePage } from "@inertiajs/react"
import { useState } from "react"

// Aktywna zakładka trzymana w adresie (?tab=…) – odświeżenie, „wstecz” i linki ją zachowują.
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const { url } = usePage()
  const fromUrl = new URLSearchParams(url.split("?")[1] ?? "").get("tab") as T | null
  const [tab, setTab] = useState<T>(fromUrl && tabs.includes(fromUrl) ? fromUrl : fallback)

  const change = (next: T) => {
    setTab(next)
    const location = new URL(window.location.href)
    if (next === fallback) location.searchParams.delete("tab")
    else location.searchParams.set("tab", next)
    window.history.replaceState(window.history.state, "", location)
  }

  return [tab, change]
}
