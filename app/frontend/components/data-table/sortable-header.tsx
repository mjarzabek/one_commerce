import type { CellData, HeaderContext, RowData } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { DataTableFeatures } from "@/components/data-table/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type Context<T extends RowData, V extends CellData> = HeaderContext<DataTableFeatures, T, V>

const triggerClass = (active: boolean) => cn("hover:text-foreground inline-flex items-center gap-1", active && "text-foreground")

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  const Icon = dir === "asc" ? ArrowUpIcon : dir === "desc" ? ArrowDownIcon : ArrowUpDownIcon
  return <Icon className={cn("size-3.5", !dir && "opacity-40")} />
}

// Nagłówek kolumny sortowanej kliknięciem (A→Z, Z→A). Id kolumny = pole sortowania na serwerze.
export function SortableHeader<T extends RowData, V extends CellData>({ context, children }: { context: Context<T, V>; children: ReactNode }) {
  const dir = context.column.getIsSorted()
  return (
    <button type="button" onClick={context.column.getToggleSortingHandler()} className={triggerClass(!!dir)}>
      {children}
      <SortIcon dir={dir} />
    </button>
  )
}

export type SortOption = { field: string; dir: "asc" | "desc"; label: string }

// Nagłówek kolumny łączącej kilka pól (np. nazwa, ID i SKU w jednej komórce): sortowanie wybierane z menu.
export function SortMenuHeader<T extends RowData, V extends CellData>({ context, options, children }: { context: Context<T, V>; options: SortOption[]; children: ReactNode }) {
  const [current] = context.table.atoms.sorting.get()
  const active = current ? options.find((option) => option.field === current.id && option.dir === (current.desc ? "desc" : "asc")) : undefined
  const key = (option: Pick<SortOption, "field" | "dir">) => `${option.field}:${option.dir}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass(!!active)}>
        {children}
        <SortIcon dir={active?.dir ?? false} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuRadioGroup
          value={active ? key(active) : ""}
          onValueChange={(value) => {
            const option = options.find((o) => key(o) === value)
            if (option) context.table.setSorting([{ id: option.field, desc: option.dir === "desc" }])
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={key(option)} value={key(option)}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
