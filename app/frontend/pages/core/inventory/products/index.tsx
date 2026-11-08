import { Head, Link, router } from "@inertiajs/react"
import { ChevronDownIcon, LibraryIcon, PlusIcon, ShirtIcon, TagIcon, TagsIcon, Trash2Icon, WarehouseIcon } from "lucide-react"
import { useMemo } from "react"

import { BulkActionBar } from "@/components/data-table/bulk-action-bar"
import { DataTable } from "@/components/data-table/data-table"
import { EmptyState } from "@/components/data-table/empty-state"
import type { PaginationState } from "@/components/data-table/pagination"
import { DataTableToolbar } from "@/components/data-table/toolbar"
import type { FilterSchema, FilterValues } from "@/components/data-table/types"
import { useServerTable, type Params } from "@/components/data-table/use-server-table"
import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { productColumns } from "@/components/inventory/product-list/columns"
import type { ListRow, ProductRow, Warehouse } from "@/components/inventory/product-list/types"
import { StatusBadge } from "@/components/inventory/status-badge"
import { productsWord, type CatalogOption } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import { PageBar } from "@/components/page-bar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type View = { q: string; catalog_id: number; warehouse_id: number | null; price_group_id: number; sort: string; dir: "asc" | "desc" }

type Props = {
  products: ProductRow[]
  pagination: PaginationState
  filterSchema: FilterSchema[]
  filters: FilterValues
  view: View
  catalogs: CatalogOption[]
  catalog: CatalogOption
  warehouses: Warehouse[]
  statuses: Record<string, string>
  priceGroups: { id: number; name: string; currency: string }[]
}

const ALL = "all"
const rowId = (row: ListRow) => row.id
const subRows = (row: ListRow) => row.variants

export default function InventoryProducts({ products, pagination, filterSchema, filters, view, catalogs, catalog, warehouses, statuses, priceGroups }: Props) {
  const table = useServerTable({
    url: "/inventory",
    view,
    pagination,
    filterSchema,
    filters,
    persist: {
      key: "inventory-products-view",
      keys: ["sort", "dir", "per", "catalog_id", "price_group_id", "warehouse_id"],
      // Zapamiętany katalog mógł zostać usunięty - wtedy przywracamy tylko sortowanie i liczbę na stronę.
      sanitize: (saved: Params) => (catalogs.some((c) => c.id === saved.catalog_id) ? saved : { sort: saved.sort, dir: saved.dir, per: saved.per }),
    },
  })
  const { visit, selection } = table

  // Stan zmienia się z listy w jednym magazynie: wybranym nad tabelą albo jedynym w katalogu.
  const stockWarehouse = view.warehouse_id ? warehouses.find((w) => w.id === view.warehouse_id) : warehouses.length === 1 ? warehouses[0] : undefined
  const columns = useMemo(
    () => productColumns({ priceGroupId: view.price_group_id, stockWarehouse, statuses }),
    [view.price_group_id, stockWarehouse, statuses],
  )

  const pageIds = products.map((product) => product.id)
  const pageSelected = pageIds.length > 0 && pageIds.every(selection.isSelected)
  const selectedCount = selection.count(pagination.total)

  const bulk = (operation: Record<string, string>) =>
    router.post("/inventory/products/bulk", table.bulkParams(operation), { preserveScroll: true, onSuccess: () => selection.clear() })

  return (
    <>
      <Head title="Produkty" />
      <PageBar
        breadcrumbs={[{ label: "Produkty" }]}
        actions={
          <Link href={`/inventory/products/new?catalog_id=${catalog.id}`} className={buttonVariants()}>
            <PlusIcon />
            Dodaj produkt
          </Link>
        }
      />

      <Card className="gap-0 py-0">
        <InventoryTabs className="mt-0 px-2" />

        <DataTableToolbar id="inventory-products" server={table} searchLabel="Szukaj po nazwie lub ID">
          {catalogs.length > 1 && (
            <OptionSelect
              className="w-auto"
              icon={LibraryIcon}
              label="Katalog"
              options={catalogs.map((c) => ({ value: String(c.id), label: c.name }))}
              value={String(catalog.id)}
              onChange={(value) => visit({ catalog_id: Number(value), warehouse_id: null, price_group_id: null })}
            />
          )}
          {priceGroups.length > 1 && (
            <OptionSelect
              className="w-auto"
              icon={TagsIcon}
              label="Cena w grupie cenowej"
              options={priceGroups.map((g) => ({ value: String(g.id), label: g.name }))}
              value={String(view.price_group_id)}
              onChange={(value) => visit({ price_group_id: Number(value) }, { reset: false })}
            />
          )}
          {warehouses.length > 1 && (
            <OptionSelect
              className="w-auto"
              icon={WarehouseIcon}
              label="Stan w magazynie"
              options={[{ value: ALL, label: "Wszystkie magazyny" }, ...warehouses.map((w) => ({ value: String(w.id), label: w.name }))]}
              value={view.warehouse_id ? String(view.warehouse_id) : ALL}
              onChange={(value) => visit({ warehouse_id: value === ALL ? null : Number(value) }, { reset: false })}
            />
          )}
        </DataTableToolbar>

        <DataTable<ListRow>
          data={products}
          columns={columns}
          rowId={rowId}
          getSubRows={subRows}
          server={table}
          selectable
          rowLabel={(row) => row.name}
          noun={productsWord}
          className="min-w-[760px]"
          empty={
            table.filtered ? (
              <EmptyState
                icon={ShirtIcon}
                title="Brak produktów spełniających kryteria"
                action={
                  <Button variant="outline" onClick={table.clearAll}>
                    Wyczyść wyszukiwanie i filtry
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={ShirtIcon} title="Brak produktów w tym katalogu" description="Dodaj produkt, żeby sprzedawać go na live i w kanałach." />
            )
          }
        />
      </Card>

      {/* Miejsce na pasek akcji, żeby nie zasłaniał ostatniego wiersza. */}
      {selectedCount > 0 && <div className="h-16" aria-hidden />}

      <BulkActionBar
        count={selectedCount}
        onClear={selection.clear}
        total={pagination.total}
        pageSelected={pageSelected}
        onPage={(selected) => selection.setPage(pageIds, selected)}
        onAll={selection.selectAll}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline">
                <TagIcon />
                Zmień status
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent side="top" align="start">
            {Object.entries(statuses).map(([value, label]) => (
              <DropdownMenuItem key={value} onClick={() => bulk({ operation: "status", new_status: value })}>
                <StatusBadge status={value} label={label} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDelete
          title={`Usunąć ${selectedCount} ${productsWord(selectedCount)}?`}
          description="Produkty zostaną usunięte razem z wariantami, zdjęciami, stanem i historią. Zamówienia z tymi produktami zostają. Tej operacji nie można cofnąć."
          onConfirm={() => bulk({ operation: "delete" })}
          trigger={
            <Button variant="destructive">
              <Trash2Icon />
              Usuń
            </Button>
          }
        />
      </BulkActionBar>
    </>
  )
}
