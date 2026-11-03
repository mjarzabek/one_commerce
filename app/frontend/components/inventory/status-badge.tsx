import { cn } from "@/lib/utils"

const DOTS: Record<string, string> = {
  active: "bg-emerald-500",
  draft: "bg-muted-foreground/50",
}

// Status produktu z kolorową kropką: aktywny (zielony), szkic (szary).
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-2 rounded-full", DOTS[status] ?? "bg-muted-foreground/50")} aria-hidden />
      {label}
    </span>
  )
}
