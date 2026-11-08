import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

// Pusty stan listy (w komórce tabeli albo samodzielnie): ikona, tytuł, opis albo akcja.
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
      <Icon className="size-6" />
      <p className="text-foreground font-medium">{title}</p>
      {description && <p className="text-sm">{description}</p>}
      {action}
    </div>
  )
}
