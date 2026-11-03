import { CheckIcon, RotateCcwIcon } from "lucide-react"

import { FloatingBar } from "@/components/floating-bar"
import { Button } from "@/components/ui/button"

// Pasek zapisu przyklejony do dołu ekranu - widoczny, gdy formularz ma niezapisane zmiany (albo zawsze, np. przy nowym produkcie).
export function SaveBar({
  visible,
  processing,
  label = "Zapisz",
  onSave,
  onDiscard,
}: {
  visible: boolean
  processing: boolean
  label?: string
  onSave: () => void
  onDiscard?: () => void
}) {
  if (!visible) return null

  return (
    <>
      <div className="h-16" aria-hidden />
      <FloatingBar>
        <div
          role="region"
          aria-label="Zapisywanie"
          className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-auto flex items-center gap-3 rounded-xl p-2 pl-4 shadow-lg ring-1"
        >
          <span className="text-sm font-medium">Niezapisane zmiany</span>
          {onDiscard && (
            <Button variant="ghost" disabled={processing} onClick={onDiscard}>
              <RotateCcwIcon />
              Odrzuć
            </Button>
          )}
          <Button disabled={processing} onClick={onSave}>
            <CheckIcon />
            {processing ? "Zapisywanie…" : label}
          </Button>
        </div>
      </FloatingBar>
    </>
  )
}
