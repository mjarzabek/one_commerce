import { XIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

// Pasek akcji masowych przyklejony do dołu ekranu – widoczny, gdy coś jest zaznaczone.
export function BulkActionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <div
        role="toolbar"
        aria-label="Akcje na zaznaczonych"
        className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl p-2 pl-3 shadow-lg ring-1"
      >
        <span className="text-sm font-medium tabular-nums">Zaznaczono: {count}</span>
        <div className="bg-border h-5 w-px" />
        {children}
        <Button variant="ghost" size="icon-sm" aria-label="Wyczyść zaznaczenie" onClick={onClear}>
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
