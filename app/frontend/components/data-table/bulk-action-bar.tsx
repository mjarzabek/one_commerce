import { ChevronDownIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"

import { FloatingBar } from "@/components/floating-bar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type BulkActionBarProps = {
  count: number
  onClear: () => void
  children: ReactNode
  // Opcjonalnie: menu przy liczniku do (od)zaznaczania bieżącej strony i wszystkich pasujących (wszystkie strony).
  total?: number
  pageSelected?: boolean
  onPage?: (selected: boolean) => void
  onAll?: () => void
}

// Pasek akcji masowych przyklejony do dołu ekranu - widoczny, gdy coś jest zaznaczone.
export function BulkActionBar({ count, onClear, children, total, pageSelected = false, onPage, onAll }: BulkActionBarProps) {
  if (count === 0) return null

  const label = (
    <span className="tabular-nums">
      Zaznaczono: {count}
      {total !== undefined && <span className="text-muted-foreground font-normal"> / {total}</span>}
    </span>
  )

  return (
    <FloatingBar>
      <div
        role="toolbar"
        aria-label="Akcje na zaznaczonych"
        className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl p-2 pl-3 shadow-lg ring-1"
      >
        {onPage && onAll ? (
          // Zaznaczanie schowane w menu licznika - dwa kliknięcia, więc nie da się go wywołać przypadkiem.
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="-ml-2 font-medium">
                  {label}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
            <DropdownMenuContent side="top" align="start" className="w-auto whitespace-nowrap">
              <DropdownMenuCheckboxItem checked={pageSelected} onCheckedChange={onPage}>
                Zaznacz na tej stronie
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={count === total} onCheckedChange={(checked) => (checked ? onAll() : onClear())}>
                Zaznacz wszystkie
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm font-medium">{label}</span>
        )}
        <div className="bg-border h-5 w-px" />
        {children}
        <Button variant="ghost" size="icon-sm" aria-label="Wyczyść zaznaczenie" onClick={onClear}>
          <XIcon />
        </Button>
      </div>
    </FloatingBar>
  )
}
