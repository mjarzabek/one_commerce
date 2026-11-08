import { Combobox } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

// Wybór z długiej listy z wyszukiwaniem (np. kategorie importowane z marketplace'ów) - wygląda jak OptionSelect,
// a po otwarciu ma pole szukania nad listą. Pokazuje najwyżej `limit` pasujących pozycji.
export function OptionCombobox({
  options,
  value,
  onChange,
  id,
  placeholder = "Wybierz",
  searchPlaceholder = "Szukaj…",
  emptyText = "Brak wyników",
  label,
  invalid,
  limit = 200,
}: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  label?: string
  invalid?: boolean
  limit?: number
}) {
  const selected = options.find((option) => option.value === value) ?? null

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? "")}
      itemToStringLabel={(option: Option) => option.label}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      limit={limit}
    >
      <Combobox.Trigger
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 aria-invalid:ring-3"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="isolate z-50">
          <Combobox.Popup
            aria-label={label}
            className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-64 origin-(--transform-origin) flex-col overflow-hidden rounded-lg shadow-md ring-1 duration-100"
          >
            <div className="flex items-center gap-2 border-b px-2.5">
              <SearchIcon className="text-muted-foreground size-4 shrink-0" />
              <Combobox.Input placeholder={searchPlaceholder} className="placeholder:text-muted-foreground h-9 w-full bg-transparent text-sm outline-none" />
            </div>
            <Combobox.Empty className="text-muted-foreground px-2.5 py-3 text-sm empty:hidden">{emptyText}</Combobox.Empty>
            <Combobox.List className="max-h-72 overflow-y-auto overscroll-contain p-1 empty:hidden">
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden select-none"
                >
                  <span className="truncate">{option.label}</span>
                  <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
