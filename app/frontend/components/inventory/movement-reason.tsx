import { ArrowDownIcon, ArrowDownToLineIcon, ArrowUpIcon, ShoppingCartIcon, SlidersHorizontalIcon, Undo2Icon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Rodzaje ruchów magazynowych: ikona i kolor, żeby historię dało się „przeczytać” jednym spojrzeniem.
const REASONS: Record<string, { icon: LucideIcon; className: string }> = {
  Przyjęcie: { icon: ArrowDownToLineIcon, className: "text-emerald-700 dark:text-emerald-400" },
  Sprzedaż: { icon: ShoppingCartIcon, className: "text-sky-700 dark:text-sky-400" },
  "Zmiana ręczna": { icon: SlidersHorizontalIcon, className: "text-amber-700 dark:text-amber-400" },
  Zwrot: { icon: Undo2Icon, className: "text-violet-700 dark:text-violet-400" },
}

export function MovementReason({ reason }: { reason: string }) {
  const { icon: Icon, className } = REASONS[reason] ?? { icon: SlidersHorizontalIcon, className: "" }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn("size-3.5", className)} />
      {reason}
    </span>
  )
}

const ARROWS = {
  up: { icon: ArrowUpIcon, label: "Wzrost", className: "text-emerald-600 dark:text-emerald-400" },
  down: { icon: ArrowDownIcon, label: "Spadek", className: "text-destructive" },
} as const

// Zmiana wartości (stan, cena): strzałka (wzrost - zielona w górę, spadek - czerwona w dół; opis po najechaniu),
// przekreślona poprzednia i nowa wartość. Bez wzrostu i spadku (np. ustawienie ceny) - sama nowa wartość.
export function ValueChange({ direction, before, after }: { direction: string | null; before: ReactNode; after: ReactNode }) {
  const arrow = direction === "up" || direction === "down" ? ARROWS[direction] : null
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {arrow && (
        <span title={arrow.label} className="inline-flex">
          <arrow.icon className={cn("size-4 shrink-0", arrow.className)} aria-label={arrow.label} />
        </span>
      )}
      {before != null && <span className="text-muted-foreground line-through">{before}</span>}
      <span className="font-medium">{after}</span>
    </span>
  )
}

// Zmiana stanu: strzałka, stan przed (przekreślony) i po.
export function StockChange({ before, after }: { before: number; after: number }) {
  return <ValueChange direction={after > before ? "up" : after < before ? "down" : null} before={before} after={after} />
}
