import { ArrowDownToLineIcon, ShoppingCartIcon, SlidersHorizontalIcon, Undo2Icon, type LucideIcon } from "lucide-react"

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
    <span className={cn("inline-flex items-center gap-1.5 font-medium", className)}>
      <Icon className="size-3.5" />
      {reason}
    </span>
  )
}

// Zmiana stanu w jednym polu: „12 → 10” i plakietka z różnicą.
export function StockChange({ before, after, quantity }: { before: number; after: number; quantity: number }) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="text-muted-foreground">{before}</span>
      <span className="text-muted-foreground/60" aria-hidden>
        →
      </span>
      <span className="font-semibold">{after}</span>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-xs font-medium",
          quantity < 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        )}
      >
        {quantity > 0 ? `+${quantity}` : `−${Math.abs(quantity)}`}
      </span>
      <span className="sr-only">
        (było {before}, jest {after})
      </span>
    </span>
  )
}
