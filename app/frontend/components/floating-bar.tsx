import type { ReactNode } from "react"

import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Miejsce na pasek przyklejony do dołu ekranu (zapis zmian, akcje masowe) - wyśrodkowany względem obszaru treści,
// nie całego okna: od md po lewej jest sidebar (szeroki albo zwinięty do ikon).
export function FloatingBar({ children }: { children: ReactNode }) {
  const { state } = useSidebar()

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] transition-[left] duration-200 ease-linear",
        state === "expanded" ? "md:left-(--sidebar-width)" : "md:left-(--sidebar-width-icon)",
      )}
    >
      {children}
    </div>
  )
}
