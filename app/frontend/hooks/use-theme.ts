import { useCallback, useEffect, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"

// Motyw zapisany w localStorage pod `theme`. Ten sam klucz czyta skrypt w <head> (application.html.erb),
// który ustawia klasę `.dark` przed pierwszym renderem – bez mignięcia jasnej strony.
const STORAGE_KEY = "theme"
const listeners = new Set<() => void>()
const media = () => window.matchMedia("(prefers-color-scheme: dark)")

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && media().matches)
  document.documentElement.classList.toggle("dark", dark)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme)

  // Motyw systemowy śledzi zmianę ustawień systemu na żywo.
  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const query = media()
    const onChange = () => applyTheme("system")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // brak localStorage – motyw obowiązuje do przeładowania
    }
    applyTheme(next)
    listeners.forEach((listener) => listener())
  }, [])

  const resolved: "light" | "dark" = theme === "system" ? (media().matches ? "dark" : "light") : theme

  return { theme, resolved, setTheme }
}
