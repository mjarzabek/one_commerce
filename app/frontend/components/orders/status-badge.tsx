import type { StatusColor } from "@/components/orders/types"
import { cn } from "@/lib/utils"

// Kolory statusów zamówień (klucze z Orders::Status::COLORS).
export const STATUS_DOTS: Record<StatusColor, string> = {
  gray: "bg-muted-foreground/50",
  blue: "bg-blue-500",
  sky: "bg-sky-400",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
}

export const STATUS_COLOR_LABELS: Record<StatusColor, string> = {
  gray: "Szary",
  blue: "Niebieski",
  sky: "Błękitny",
  violet: "Fioletowy",
  pink: "Różowy",
  green: "Zielony",
  amber: "Żółty",
  orange: "Pomarańczowy",
  red: "Czerwony",
}

export function StatusDot({ color, className }: { color: StatusColor; className?: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOTS[color] ?? STATUS_DOTS.gray, className)} aria-hidden />
}

// Status zamówienia: kolorowa kropka i nazwa.
export function OrderStatusBadge({ name, color, className }: { name: string; color: StatusColor; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <StatusDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  )
}
