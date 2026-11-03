import { usePage } from "@inertiajs/react"
import { CircleAlertIcon, CircleCheckIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Komunikaty z `redirect_to …, notice:/alert:` - widoczne do zamknięcia albo następnej wizyty.
export function FlashMessages() {
  const { flash } = usePage()
  const [hidden, setHidden] = useState(false)

  useEffect(() => setHidden(false), [flash])

  const message = flash?.alert ?? flash?.notice
  if (!message || hidden) return null

  const isAlert = !!flash?.alert
  const Icon = isAlert ? CircleAlertIcon : CircleCheckIcon

  return (
    <div
      role={isAlert ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        isAlert ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/50",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <Button variant="ghost" size="icon-sm" onClick={() => setHidden(true)} aria-label="Zamknij">
        <XIcon />
      </Button>
    </div>
  )
}
