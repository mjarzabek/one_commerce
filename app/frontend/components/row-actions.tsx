import { MoreHorizontalIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type RowAction = {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  hidden?: boolean
}

// Akcje wiersza tabeli (albo strony - `size="icon"`) schowane pod „⋯”. Akcje usuwające trafiają na koniec, za separatorem.
export function RowActions({ actions, label = "Akcje", size = "icon-xs" }: { actions: RowAction[]; label?: string; size?: "icon-xs" | "icon" }) {
  const visible = actions.filter((action) => !action.hidden)
  const regular = visible.filter((action) => !action.destructive)
  const destructive = visible.filter((action) => action.destructive)

  const item = (action: RowAction) => (
    <DropdownMenuItem key={action.label} variant={action.destructive ? "destructive" : "default"} disabled={action.disabled} onClick={action.onSelect}>
      <action.icon />
      {action.label}
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size={size} aria-label={label} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        {regular.map(item)}
        {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
