import { CheckIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// Pasek zapisu przyklejony do dołu ekranu – widoczny, gdy formularz ma niezapisane zmiany (albo zawsze, np. przy nowym produkcie).
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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div
          role="region"
          aria-label="Zapisywanie"
          className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-auto flex items-center gap-3 rounded-xl p-2 pl-4 shadow-lg ring-1"
        >
          <span className="text-sm font-medium">Niezapisane zmiany</span>
          {onDiscard && (
            <Button variant="ghost" size="sm" disabled={processing} onClick={onDiscard}>
              <RotateCcwIcon />
              Odrzuć
            </Button>
          )}
          <Button size="sm" disabled={processing} onClick={onSave}>
            <CheckIcon />
            {processing ? "Zapisywanie…" : label}
          </Button>
        </div>
      </div>
    </>
  )
}
