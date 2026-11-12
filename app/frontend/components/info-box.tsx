import { InfoIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Krótkie wyjaśnienie, do czego służy ekran (np. ustawienia): ikona, pogrubiony tytuł i opis.
export function InfoBox({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-muted/50 flex gap-3 rounded-lg border p-3 text-sm", className)}>
      <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground space-y-1">{children}</div>
      </div>
    </div>
  )
}
