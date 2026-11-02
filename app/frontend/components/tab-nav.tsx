import { Link } from "@inertiajs/react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type TabItem = {
  value: string
  label: ReactNode
  href?: string
  icon?: LucideIcon
  error?: boolean
}

// Zakładki pod górnym paskiem – jeden wygląd w całym panelu. Z `href` działają jak linki (sekcje),
// bez – przełączają widok na stronie (`onChange`).
export function TabNav({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[]
  value: string
  onChange?: (value: string) => void
  label: string
}) {
  const className = (active: boolean) =>
    cn(
      "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
      active ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
    )

  return (
    <nav className="-mt-1 flex gap-1 overflow-x-auto border-b" aria-label={label}>
      {items.map((item) => {
        const active = item.value === value
        const Icon = item.icon
        const content = (
          <>
            {Icon && <Icon className="size-4" />}
            {item.label}
            {item.error && <span className="bg-destructive size-1.5 rounded-full" aria-label="błędy w zakładce" />}
          </>
        )
        return item.href ? (
          <Link key={item.value} href={item.href} aria-current={active ? "page" : undefined} className={className(active)}>
            {content}
          </Link>
        ) : (
          <button key={item.value} type="button" aria-current={active ? "page" : undefined} className={className(active)} onClick={() => onChange?.(item.value)}>
            {content}
          </button>
        )
      })}
    </nav>
  )
}
