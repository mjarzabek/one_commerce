import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

// Prosty select z listą opcji (wartość i etykieta) na bazie Base UI.
export function OptionSelect({
  options,
  value,
  onChange,
  className,
  id,
  disabled,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  disabled?: boolean
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v !== null && onChange(String(v))} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
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
