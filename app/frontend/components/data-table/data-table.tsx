import {
  createColumnHelper,
  createExpandedRowModel,
  functionalUpdate,
  metaHelper,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
  type Updater,
} from "@tanstack/react-table"
import { useMemo, type ReactNode } from "react"

import { Pagination } from "@/components/data-table/pagination"
import type { ServerTable } from "@/components/data-table/use-server-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

// `width` - klasa szerokości kolumny (np. "w-32"); bez niej kolumna zajmuje resztę miejsca.
// `align: "right"` - liczby (ceny, stany). `className` trafia do komórek, `headerClassName` do nagłówka.
// `skeleton` - zawartość komórki podczas ładowania (domyślnie szary pasek, `null` - pusta); powinna mieć wysokość
// prawdziwej komórki, żeby po doładowaniu wiersze nie skakały.
export type DataTableColumnMeta = { width?: string; align?: "right"; className?: string; headerClassName?: string; skeleton?: ReactNode }

// Liczba wierszy skeletonu przy pierwszym ładowaniu listy.
const SKELETON_ROWS = 10

// Wspólny zestaw funkcji wszystkich tabel w aplikacji. Sortowanie i paginację liczy serwer; tabela tylko je pokazuje.
// Nowa funkcja TanStacka (np. ukrywanie kolumn) - dopisać tutaj i obsłużyć w <DataTable>.
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type DataTableFeatures = typeof dataTableFeatures

// Definicje kolumn: `const col = columnHelper<Product>()`, potem `col.columns([col.accessor("price", {...}), col.display({...})])`.
// Id kolumny z sortowaniem musi być nazwą pola sortowania po stronie serwera.
export const columnHelper = <T extends RowData>() => createColumnHelper<DataTableFeatures, T>()

type DataTableProps<T extends RowData> = {
  data: T[]
  // Kolumny trzymać stabilne (stała modułu albo useMemo) - nowa tablica przy każdym renderze przelicza całą tabelę.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ReadonlyArray<ColumnDef<DataTableFeatures, T, any>>
  rowId: (row: T) => number
  // Wiersze podrzędne (np. warianty) - rozwijane `row.getToggleExpandedHandler()`.
  getSubRows?: (row: T) => T[] | undefined
  // Stan listy z useServerTable: sortowanie, paginacja i zaznaczenie. Bez niego - zwykła tabela.
  server?: ServerTable
  // Kolumna checkboxów spięta z `server.selection` (tylko wiersze główne).
  selectable?: boolean
  rowLabel?: (row: T) => string
  noun?: (count: number) => string
  empty: ReactNode
  // Dane jeszcze nie przyszły (deferred props) - nagłówki jak zwykle, zamiast wierszy i paginacji skeleton.
  loading?: boolean
  className?: string
}

export function DataTable<T extends RowData>({
  data,
  columns,
  rowId,
  getSubRows,
  server,
  selectable = false,
  rowLabel,
  noun,
  empty,
  loading = false,
  className,
}: DataTableProps<T>) {
  const sortField = server?.sort.field
  const sortDir = server?.sort.dir
  const sorting = useMemo<SortingState>(() => (sortField ? [{ id: sortField, desc: sortDir === "desc" }] : []), [sortField, sortDir])

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row, _index, parent) => (parent ? `${parent.id}.${rowId(row)}` : String(rowId(row))),
    getSubRows,
    state: { sorting },
    onSortingChange: (updater: Updater<SortingState>) => {
      const [next] = functionalUpdate(updater, sorting)
      if (next && server) server.sort.set(next.id, next.desc ? "desc" : "asc")
    },
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    // Rozwinięte warianty zostają po przeładowaniu danych (np. po zmianie ceny z listy).
    autoResetExpanded: false,
  })

  const selection = selectable ? server?.selection : undefined
  const pageIds = data.map(rowId)
  const pageSelected = !!selection && pageIds.length > 0 && pageIds.every(selection.isSelected)
  const pageSomeSelected = !!selection && pageIds.some(selection.isSelected)

  const leafColumns = table.getAllLeafColumns()
  const lastIndex = leafColumns.length - 1
  // Skrajne komórki mają większy odstęp od krawędzi karty.
  const edge = (index: number) => cn(index === 0 && !selection && "pl-4", index === lastIndex && "pr-4")
  const meta = (column: { columnDef: { meta?: DataTableColumnMeta } }) => column.columnDef.meta ?? {}

  const pagination = server && (
    <div className="border-t px-4 py-2 first:border-t-0">
      {server.pagination && !loading ? (
        <Pagination pagination={server.pagination} noun={noun?.(server.pagination.total) ?? ""} onPage={server.goToPage} onPer={server.setPer} />
      ) : (
        // Wysokość jak paginacja (przycisk „1-50 ▾”), żeby tabela nie przesunęła się po doładowaniu.
        <div className="flex h-8 items-center">
          <Skeleton className="h-4 w-36" />
        </div>
      )}
    </div>
  )

  const rows = table.getRowModel().rows
  // Po zmianie widoku stare wiersze zostają na miejscu i przygasają, dopóki serwer nie odpowie.
  const busy = loading || !!server?.loading

  return (
    <>
      {pagination}
      <div className="overflow-x-auto border-t first:border-t-0">
        {/* Stały układ kolumn - szerokości nie zależą od treści, więc tabela nie „skacze” przy zmianie strony. */}
        <Table className={cn("table-fixed", className)} aria-busy={busy}>
          <colgroup>
            {selection && <col className="w-10" />}
            {leafColumns.map((column) => (
              <col key={column.id} className={meta(column).width} />
            ))}
          </colgroup>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {selection && (
                  <TableHead className="pl-4">
                    <Checkbox
                      aria-label="Zaznacz wszystkie na stronie"
                      checked={pageSelected}
                      indeterminate={!pageSelected && pageSomeSelected}
                      disabled={loading || pageIds.length === 0}
                      onCheckedChange={(checked) => selection.setPage(pageIds, !!checked)}
                    />
                  </TableHead>
                )}
                {group.headers.map((header, index) => {
                  const { align, headerClassName } = meta(header.column)
                  return (
                    <TableHead key={header.id} className={cn(align === "right" && "text-right", edge(index), headerClassName)}>
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn("transition-opacity", server?.loading && !loading && "pointer-events-none opacity-50")}>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={index} className="hover:bg-transparent">
                  {selection && (
                    <TableCell className="pl-4">
                      <Skeleton className="size-4" />
                    </TableCell>
                  )}
                  {leafColumns.map((column, columnIndex) => {
                    const { align, skeleton } = meta(column)
                    return (
                      <TableCell key={column.id} className={cn(edge(columnIndex))}>
                        {skeleton !== undefined ? skeleton : <Skeleton className={cn("h-4 w-3/4", align === "right" && "ml-auto")} />}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length + (selection ? 1 : 0)} className="h-48">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const child = row.depth > 0
                const id = rowId(row.original)
                const selected = !!selection && !child && selection.isSelected(id)
                return (
                  <TableRow key={row.id} data-state={selected ? "selected" : undefined} className={cn(child && "bg-muted/30")}>
                    {selection && (
                      <TableCell className="pl-4">
                        {!child && (
                          <Checkbox aria-label={`Zaznacz ${rowLabel?.(row.original) ?? id}`} checked={selected} onCheckedChange={() => selection.toggle(id)} />
                        )}
                      </TableCell>
                    )}
                    {row.getAllCells().map((cell, index) => {
                      const { align, className: cellClassName } = meta(cell.column)
                      return (
                        <TableCell key={cell.id} className={cn(align === "right" && "text-right tabular-nums", edge(index), cellClassName)}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {pagination}
    </>
  )
}
