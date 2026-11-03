import type { LucideIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

// Prosty select z listą opcji (wartość i etykieta) na bazie Base UI. Z `icon` ikona zastępuje opis pola
// (np. „Cena:”) - `label` trafia wtedy do podpowiedzi i czytników ekranu.
export function OptionSelect({
  options,
  value,
  onChange,
  className,
  id,
  disabled,
  icon: Icon,
  label,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  disabled?: boolean
  icon?: LucideIcon
  label?: string
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v !== null && onChange(String(v))} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={label} title={label}>
        {Icon && <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />}        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
