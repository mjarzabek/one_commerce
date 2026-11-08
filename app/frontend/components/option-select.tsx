import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

// Prosty select z listą opcji (wartość i etykieta) na bazie Base UI. `label` (opcjonalnie) trafia do
// podpowiedzi i czytników ekranu, gdy pole nie ma widocznej etykiety.
export function OptionSelect({
  options,
  value,
  onChange,
  className,
  id,
  disabled,
  label,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  disabled?: boolean
  label?: string
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v !== null && onChange(String(v))} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={label} title={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
