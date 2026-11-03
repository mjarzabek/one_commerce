import { Head, Link, router, usePage } from "@inertiajs/react"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  ShirtIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"

import { BulkActionBar } from "@/components/data-table/bulk-action-bar"
import { FilterChips } from "@/components/data-table/filter-chips"
import { FilterPanel, FilterToggle } from "@/components/data-table/filter-panel"
import { Pagination } from "@/components/data-table/pagination"
import { activeFilterCount, emptyFilterValues, type FilterSchema, type FilterValues } from "@/components/data-table/types"
import { useSelection } from "@/components/data-table/use-selection"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InlinePrice, InlineStock, LockedStock, StockValue } from "@/components/inventory/inline-edit"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { OptionSelect } from "@/components/option-select"
import { StatusBadge } from "@/components/inventory/status-badge"
import type { CatalogOption } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

// `stock` - dostępne sztuki, `reserved` - rezerwacje (w magazynach kolumny „Stan”).
// `sellable` - produkt prosty albo wariant: cenę i stan można zmienić z listy.
type Row = {
  id: number
  name: string
  sku: string | null
  ean: string | null
  price: string | null
  priceInput: string | null
  stock: number
  reserved: number
  sellable: boolean
}
type ProductRow = Row & { status: string; variants: Row[] }

type View = { q: string; catalog_id: number; warehouse_id: number | null; price_group_id: number; sort: string; dir: "asc" | "desc" }

type Props = {
  products: ProductRow[]
  pagination: { page: number; pages: number; per: number; total: number }
  filterSchema: FilterSchema[]
  filters: FilterValues
  view: View
  catalogs: CatalogOption[]
  catalog: CatalogOption
  warehouses: { id: number; name: string; strict_control: boolean }[]
  statuses: Record<string, string>
  priceGroups: { id: number; name: string; currency: string }[]
}

type Params = Record<string, string | number | null | undefined>

type SavedView = Pick<View, "sort" | "dir" | "catalog_id" | "price_group_id" | "warehouse_id"> & { per: number }

const ALL = "all"

const productsWord = (count: number) =>
  count === 1 ? "produkt" : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "produkty" : "produktów"

const variantsWord = (count: number) =>
  count === 1 ? "wariant" : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "warianty" : "wariantów"

// Sortowanie kolumny „Produkt” (nazwa i kody w jednej komórce): wartości `sort:dir`.
const PRODUCT_SORTS = [
  { value: "name:asc", label: "Nazwa A → Z" },
  { value: "name:desc", label: "Nazwa Z → A" },
  { value: "id:asc", label: "ID rosnąco" },
  { value: "id:desc", label: "ID malejąco" },
  { value: "sku:asc", label: "SKU A → Z" },
  { value: "sku:desc", label: "SKU Z → A" },
]

// Komórka „Produkt”: znacznik (ikona wariantów albo „↳”) w stałym miejscu, nazwa, a pod nią ID · SKU · EAN (bez pustych).
function ProductCell({ row, href, marker, variant = false }: { row: Row; href: string; marker?: React.ReactNode; variant?: boolean }) {
  const codes = (
    [
      ["ID", row.id],
      ["SKU", row.sku],
      ["EAN", row.ean],
    ] as const
  ).filter(([, value]) => value != null && value !== "")
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="text-muted-foreground flex h-5 w-9 shrink-0 items-center justify-end text-xs">{marker}</span>
      <div className="min-w-0">
        <div className="truncate">
          <Link
            href={href}
            className={cn("hover:text-primary underline-offset-4 hover:underline", !variant && "font-medium")}
            title={variant ? `Edytuj wariant „${row.name}”` : `Edytuj produkt „${row.name}”`}
          >
            {row.name}
          </Link>
        </div>
        <p className="text-muted-foreground truncate text-xs tabular-nums" title={codes.map(([label, value]) => `${label} ${value}`).join(" · ")}>
          {codes.map(([label, value], index) => (
            <Fragment key={label}>
              {index > 0 && " · "}
              <span className="opacity-70">{label}</span> {value}
            </Fragment>
          ))}
        </p>
      </div>
    </div>
  )
}

export default function InventoryProducts(props: Props) {
  const { products, pagination, filterSchema, filters, view, catalogs, catalog, warehouses, statuses, priceGroups } = props
  const [query, setQuery] = useState(view.q)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const selection = useSelection()
  const [filtersOpen, setFiltersOpen] = usePersistentState("inventory-products-filters-open", false)
  const multiWarehouse = warehouses.length > 1
  // Stan zmienia się z listy w jednym magazynie: wybranym w „Stan: …” albo jedynym w katalogu.
  const stockWarehouse = view.warehouse_id ? warehouses.find((w) => w.id === view.warehouse_id) : warehouses.length === 1 ? warehouses[0] : undefined

  const priceCell = (row: Row, name: string) =>
    row.sellable ? (
      <InlinePrice productId={row.id} name={name} priceGroupId={view.price_group_id} label={row.price} input={row.priceInput} />
    ) : (
      <span className="block truncate" title={row.price ? `${row.price} - ceny wariantów zmienisz po ich rozwinięciu` : undefined}>
        {row.price ?? "-"}
      </span>
    )

  const stockCell = (row: Row, name: string) => {
    if (row.sellable && stockWarehouse?.strict_control) return <LockedStock available={row.stock} reserved={row.reserved} />
    if (row.sellable && stockWarehouse) {
      return <InlineStock productId={row.id} name={name} warehouseId={stockWarehouse.id} available={row.stock} reserved={row.reserved} />
    }
    const hint = row.sellable ? "Stan łączny - wybierz magazyn w „Stan: …”, aby go zmienić" : "Stan wariantów zmienisz po ich rozwinięciu"
    return (
      <span title={hint}>
        <StockValue available={row.stock} reserved={row.reserved} />
      </span>
    )
  }

  // Aktualne parametry listy (wyszukiwanie, filtry, widok) - te same trafiają do akcji „wszystkie pasujące”.
  const listParams = (): Params => ({ ...filters, ...view, q: query, per: pagination.per })

  // Zmiana wyszukiwania, filtrów, katalogu lub magazynu wraca na 1. stronę i czyści zaznaczenie.
  const visit = (changes: Params, { keepSelection = false } = {}) => {
    const values: Params = { ...listParams(), page: 1, ...changes }
    const params = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v != null)) as Record<string, string | number>
    if (!keepSelection) selection.clear()
    router.get("/inventory", params, { preserveState: true, preserveScroll: true, replace: true })
  }

  // Wyszukiwanie w trakcie pisania (z opóźnieniem).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (query === view.q) return
    const timeout = setTimeout(() => visit({ q: query }), 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Widok listy zapamiętany w przeglądarce, osobno dla konta. Przy wejściu na listę przywracamy to, czego nie ma w adresie
  // (adres ma pierwszeństwo, np. link z karty produktu z `catalog_id`). Wyszukiwania, filtrów i strony nie zapamiętujemy.
  const accountId = usePage<{ account: { id: number } | null }>().props.account?.id
  const [savedView, saveView] = usePersistentState<SavedView | null>(`inventory-products-view:${accountId}`, null)
  const currentView: SavedView = {
    sort: view.sort,
    dir: view.dir,
    per: pagination.per,
    catalog_id: view.catalog_id,
    price_group_id: view.price_group_id,
    warehouse_id: view.warehouse_id,
  }
  const restoring = useRef(false)
  useEffect(() => {
    if (!savedView) return
    const url = new URLSearchParams(window.location.search)
    // Zapisany katalog mógł zostać usunięty - wtedy przywracamy tylko sortowanie i liczbę na stronę.
    const usable = catalogs.some((c) => c.id === savedView.catalog_id)
      ? savedView
      : { sort: savedView.sort, dir: savedView.dir, per: savedView.per }
    const changes = Object.fromEntries(
      Object.entries(usable).filter(([key, value]) => value != null && !url.has(key) && value !== currentView[key as keyof SavedView]),
    )
    if (Object.keys(changes).length === 0) return
    restoring.current = true
    visit(changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (restoring.current) {
      restoring.current = false
      return
    }
    saveView(currentView)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.sort, view.dir, pagination.per, view.catalog_id, view.price_group_id, view.warehouse_id])

  const toggleExpanded = (id: number) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Zaznaczenie
  const pageIds = products.map((product) => product.id)
  const pageSelected = pageIds.length > 0 && pageIds.every(selection.isSelected)
  const pageSomeSelected = pageIds.some(selection.isSelected)
  const selectedCount = selection.count(pagination.total)

  const bulk = (operation: Record<string, string>) =>
    router.post(
      "/inventory/products/bulk",
      selection.allMatching
        ? { ...listParams(), ...operation, all: "true", excluded_ids: [...selection.ids] }
        : { ...operation, ids: [...selection.ids] },
      { preserveScroll: true, onSuccess: () => selection.clear() },
    )

  const sortIcon = (active: boolean) => (!active ? ArrowUpDownIcon : view.dir === "asc" ? ArrowUpIcon : ArrowDownIcon)

  const SortHead = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const active = view.sort === field
    const Icon = sortIcon(active)
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => visit({ sort: field, dir: active && view.dir === "asc" ? "desc" : "asc", page: pagination.page }, { keepSelection: true })}
          className={cn("hover:text-foreground inline-flex items-center gap-1", active && "text-foreground")}
        >
          {children}
          <Icon className={cn("size-3.5", !active && "opacity-40")} />
        </button>
      </TableHead>
    )
  }

  const ProductSortHead = () => {
    const current = `${view.sort}:${view.dir}`
    const active = PRODUCT_SORTS.some((option) => option.value === current)
    const Icon = sortIcon(active)
    return (
      <TableHead>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("hover:text-foreground inline-flex items-center gap-1", active && "text-foreground")}>
            Produkt
            <Icon className={cn("size-3.5", !active && "opacity-40")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuRadioGroup
              value={current}
              onValueChange={(value) => {
                const [sort, dir] = String(value).split(":")
                visit({ sort, dir, page: pagination.page }, { keepSelection: true })
              }}
            >
              {PRODUCT_SORTS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableHead>
    )
  }

  const filtered = !!view.q || activeFilterCount(filterSchema, filters) > 0

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
      {/* Jedna biała karta: zakładki, wyszukiwanie i filtry, potem tabela. */}
      <Card className="gap-0 py-0">
        <InventoryTabs className="mt-0 px-2" />

        <div className="flex flex-wrap items-center gap-2 px-3 py-3">
          <div className="relative w-full sm:max-w-sm sm:flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input placeholder="Szukaj po nazwie lub ID…" aria-label="Szukaj po nazwie lub ID" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <FilterToggle schema={filterSchema} values={filters} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {catalogs.length > 1 && (
              <OptionSelect
                className="w-44"
                options={catalogs.map((c) => ({ value: String(c.id), label: `Katalog: ${c.name}` }))}
                value={String(catalog.id)}
                onChange={(value) => visit({ catalog_id: Number(value), warehouse_id: null, price_group_id: null })}
              />
            )}
            {priceGroups.length > 1 && (
              <OptionSelect
                className="w-44"
                options={priceGroups.map((g) => ({ value: String(g.id), label: `Cena: ${g.name}` }))}
                value={String(view.price_group_id)}
                onChange={(value) => visit({ price_group_id: Number(value), page: pagination.page }, { keepSelection: true })}
              />
            )}
            {multiWarehouse && (
              <OptionSelect
                className="w-52"
                options={[{ value: ALL, label: "Stan: łącznie" }, ...warehouses.map((w) => ({ value: String(w.id), label: `Stan: ${w.name}` }))]}
                value={view.warehouse_id ? String(view.warehouse_id) : ALL}
                onChange={(value) => visit({ warehouse_id: value === ALL ? null : Number(value), page: pagination.page }, { keepSelection: true })}
              />
            )}
          </div>
        </div>

        {filtersOpen ? (
          <FilterPanel
            schema={filterSchema}
            values={filters}
            onApply={(values) => visit(values)}
            className="rounded-none border-x-0 border-b-0 px-3 pt-5"
          />
        ) : (
          activeFilterCount(filterSchema, filters) > 0 && (
            <div className="px-3 pb-3">
              <FilterChips
                schema={filterSchema}
                values={filters}
                onRemove={(params) => visit(Object.fromEntries(params.map((param) => [param, ""])))}
                onClear={() => visit(emptyFilterValues(filterSchema))}
              />
            </div>
          )
        )}

        <div className="border-t px-4 py-2">
          <Pagination
            pagination={pagination}
            noun={productsWord(pagination.total)}
            onPage={(page) => visit({ page }, { keepSelection: true })}
            onPer={(per) => visit({ per }, { keepSelection: true })}
          />
        </div>

        <div className="overflow-x-auto border-t">
          {/* Stały układ kolumn - szerokości nie zależą od treści, więc tabela nie „skacze” przy zmianie strony. */}
          <Table className="min-w-[760px] table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-8" />
              <col />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-36" />
            </colgroup>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Zaznacz wszystkie na stronie"
                    checked={pageSelected}
                    indeterminate={!pageSelected && pageSomeSelected}
                    disabled={pageIds.length === 0}
                    onCheckedChange={(checked) => selection.setPage(pageIds, !!checked)}
                  />
                </TableHead>
                <TableHead className="w-8 px-0" />
                <ProductSortHead />
                <SortHead field="price" className="text-right">
                  Cena
                </SortHead>
                <SortHead field="stock" className="text-right">
                  Stan
                </SortHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                      <ShirtIcon className="size-6" />
                      <p className="text-foreground font-medium">{filtered ? "Brak produktów spełniających kryteria" : "Brak produktów w tym katalogu"}</p>
                      {filtered ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setQuery("")
                            visit({ ...emptyFilterValues(filterSchema), q: "" })
                          }}
                        >
                          Wyczyść wyszukiwanie i filtry
                        </Button>
                      ) : (
                        <p className="text-sm">Dodaj produkt, żeby sprzedawać go na live i w kanałach.</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const open = expanded.has(product.id)
                  const hasVariants = product.variants.length > 0
                  const selected = selection.isSelected(product.id)
                  return (
                    <Fragment key={product.id}>
                      <TableRow data-state={selected ? "selected" : undefined}>
                        <TableCell className="pl-4">
                          <Checkbox aria-label={`Zaznacz ${product.name}`} checked={selected} onCheckedChange={() => selection.toggle(product.id)} />
                        </TableCell>
                        <TableCell className="px-0">
                          {hasVariants && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={open ? "Zwiń warianty" : "Rozwiń warianty"}
                              aria-expanded={open}
                              onClick={() => toggleExpanded(product.id)}
                            >
                              <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <ProductCell
                            row={product}
                            href={`/inventory/products/${product.id}/edit`}
                            marker={
                              hasVariants && (
                                <span
                                  className="inline-flex items-center gap-1"
                                  title={`${product.variants.length} ${variantsWord(product.variants.length)}`}
                                >
                                  <LayersIcon className="size-3.5" />
                                  {product.variants.length}
                                </span>
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{priceCell(product, product.name)}</TableCell>
                        <TableCell className={cn("text-right font-medium tabular-nums", product.stock <= 0 && "text-destructive")}>
                          {stockCell(product, product.name)}
                        </TableCell>
                        <TableCell className="truncate pr-4">
                          <StatusBadge status={product.status} label={statuses[product.status]} />
                        </TableCell>
                      </TableRow>
                      {open &&
                        product.variants.map((variant) => (
                          <TableRow key={variant.id} className="bg-muted/30">
                            <TableCell className="pl-4" />
                            <TableCell className="px-0" />
                            <TableCell>
                              <ProductCell row={variant} href={`/inventory/variants/${variant.id}/edit`} marker="↳" variant />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{priceCell(variant, `${product.name} - ${variant.name}`)}</TableCell>
                            <TableCell className={cn("text-right tabular-nums", variant.stock <= 0 && "text-destructive")}>
                              {stockCell(variant, `${product.name} - ${variant.name}`)}
                            </TableCell>
                            <TableCell className="pr-4" />
                          </TableRow>
                        ))}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t px-4 py-2">
          <Pagination
            pagination={pagination}
            noun={productsWord(pagination.total)}
            onPage={(page) => visit({ page }, { keepSelection: true })}
            onPer={(per) => visit({ per }, { keepSelection: true })}
          />
        </div>
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
          description="Produkty z wariantami zostaną usunięte razem z wariantami. Produkty z towarem, historią magazynową lub zamówieniami zostaną pominięte - takie archiwizuj."
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
