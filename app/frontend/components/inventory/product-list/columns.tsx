import type { Row as TableRow } from "@tanstack/react-table"

import { columnHelper, type DataTableFeatures } from "@/components/data-table/data-table"
import { SortableHeader, SortMenuHeader, type SortOption } from "@/components/data-table/sortable-header"
import { InlinePrice, InlineStock, LockedStock, StockValue } from "@/components/inventory/inline-edit"
import { StatusBadge } from "@/components/inventory/status-badge"
import { cn } from "@/lib/utils"

import { HistoryLink, ProductCell, ProductThumb, VariantMarker, VariantsToggle } from "./product-cell"
import type { ListRow, Warehouse } from "./types"

// Sortowanie kolumny „Produkt” (nazwa i kody w jednej komórce).
const PRODUCT_SORTS: SortOption[] = [
  { field: "name", dir: "asc", label: "Nazwa A → Z" },
  { field: "name", dir: "desc", label: "Nazwa Z → A" },
  { field: "id", dir: "asc", label: "ID rosnąco" },
  { field: "id", dir: "desc", label: "ID malejąco" },
  { field: "sku", dir: "asc", label: "SKU A → Z" },
  { field: "sku", dir: "desc", label: "SKU Z → A" },
]

type Options = {
  priceGroupId: number
  // Magazyn, w którym stan zmienia się z listy (wybrany nad tabelą albo jedyny w katalogu).
  stockWarehouse: Warehouse | undefined
  statuses: Record<string, string>
}

type Row = TableRow<DataTableFeatures, ListRow>

const isVariant = (row: Row) => row.depth > 0
// Wariant opisujemy razem z nazwą produktu („Koszula - M”).
const fullName = (row: Row) => {
  const parent = row.getParentRow()
  return parent ? `${parent.original.name} - ${row.original.name}` : row.original.name
}
const editPath = (row: Row) => (isVariant(row) ? `/inventory/variants/${row.original.id}/edit` : `/inventory/products/${row.original.id}/edit`)

const col = columnHelper<ListRow>()

// Kolumny listy produktów. Wywoływać w useMemo - zależą od widoku (grupa cenowa, magazyn).
export const productColumns = ({ priceGroupId, stockWarehouse, statuses }: Options) =>
  col.columns([
    col.display({
      id: "product",
      header: (context) => (
        <SortMenuHeader context={context} options={PRODUCT_SORTS}>
          Produkt
        </SortMenuHeader>
      ),
      cell: ({ row }) =>
        isVariant(row) ? (
          <ProductCell row={row.original} href={editPath(row)} image={<VariantMarker />} variant />
        ) : (
          <ProductCell
            row={row.original}
            href={editPath(row)}
            image={<ProductThumb src={row.original.image ?? null} name={row.original.name} />}
            addon={row.getCanExpand() && <VariantsToggle count={row.subRows.length} open={row.getIsExpanded()} onToggle={row.getToggleExpandedHandler()} />}
          />
        ),
    }),

    col.accessor("price", {
      header: (context) => <SortableHeader context={context}>Cena</SortableHeader>,
      meta: { width: "w-32", align: "right" },
      cell: ({ row }) => {
        const item = row.original
        if (item.sellable) {
          return <InlinePrice productId={item.id} name={fullName(row)} priceGroupId={priceGroupId} label={item.price} input={item.priceInput} />
        }
        return (
          <span className="block truncate" title={item.price ? `${item.price} - ceny wariantów zmienisz po ich rozwinięciu` : undefined}>
            {item.price ?? "-"}
          </span>
        )
      },
    }),

    col.accessor("stock", {
      header: (context) => <SortableHeader context={context}>Stan</SortableHeader>,
      meta: { width: "w-28", align: "right" },
      cell: ({ row }) => {
        const item = row.original
        let content
        if (item.sellable && stockWarehouse?.strict_control) {
          content = <LockedStock available={item.stock} reserved={item.reserved} />
        } else if (item.sellable && stockWarehouse) {
          content = <InlineStock productId={item.id} name={fullName(row)} warehouseId={stockWarehouse.id} available={item.stock} reserved={item.reserved} />
        } else {
          const hint = item.sellable ? "Stan łączny - wybierz magazyn nad tabelą, aby go zmienić" : "Stan wariantów zmienisz po ich rozwinięciu"
          content = (
            <span title={hint}>
              <StockValue available={item.stock} reserved={item.reserved} />
            </span>
          )
        }
        return <div className={cn(!isVariant(row) && "font-medium", item.stock <= 0 && "text-destructive")}>{content}</div>
      },
    }),

    col.display({
      id: "status",
      header: "Status",
      meta: { width: "w-36", className: "truncate" },
      cell: ({ row }) => row.original.status && <StatusBadge status={row.original.status} label={statuses[row.original.status]} />,
    }),

    col.display({
      id: "history",
      header: () => <span className="sr-only">Historia</span>,
      meta: { width: "w-12", align: "right" },
      cell: ({ row }) => <HistoryLink href={`${editPath(row)}?tab=history`} name={fullName(row)} />,
    }),
  ])
