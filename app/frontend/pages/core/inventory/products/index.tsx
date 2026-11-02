import { Head, Link, router } from "@inertiajs/react"
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
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { OptionSelect } from "@/components/inventory/option-select"
import { StatusBadge } from "@/components/inventory/status-badge"
import type { CatalogOption } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Row = { id: number; name: string; sku: string | null; ean: string | null; price: string | null; stock: number }
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
  warehouses: CatalogOption[]
  statuses: Record<string, string>
  priceGroups: { id: number; name: string; currency: string }[]
}

type Params = Record<string, string | number | null | undefined>

const ALL = "all"

const productsWord = (count: number) =>
  count === 1 ? "produkt" : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "produkty" : "produktów"

export default function InventoryProducts(props: Props) {
  const { products, pagination, filterSchema, filters, view, catalogs, catalog, warehouses, statuses, priceGroups } = props
  const [query, setQuery] = useState(view.q)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const selection = useSelection()
  const [filtersOpen, setFiltersOpen] = usePersistentState("inventory-products-filters-open", false)
  const multiWarehouse = warehouses.length > 1

  // Aktualne parametry listy (wyszukiwanie, filtry, widok) – te same trafiają do akcji „wszystkie pasujące”.
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
  const selectedCount = selection.allMatching ? pagination.total : selection.ids.size

  const bulk = (operation: Record<string, string>) =>
    router.post(
      "/inventory/products/bulk",
      selection.allMatching ? { ...listParams(), ...operation, all: "true" } : { ...operation, ids: [...selection.ids] },
      { preserveScroll: true, onSuccess: () => selection.clear() },
    )

  const SortHead = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const active = view.sort === field
    const Icon = !active ? ArrowUpDownIcon : view.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
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

  const filtered = !!view.q || activeFilterCount(filterSchema, filters) > 0

  return (
    <>
      <Head title="Produkty" />
      <PageBar
        breadcrumbs={[{ label: "Magazyn", href: "/inventory" }, { label: "Produkty" }]}
        actions={
          <Link href={`/inventory/products/new?catalog_id=${catalog.id}`} className={buttonVariants({ size: "sm" })}>
            <PlusIcon />
            Dodaj produkt
          </Link>
        }
      />
      <InventoryTabs />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input placeholder="Szukaj po nazwie…" aria-label="Szukaj po nazwie" className="h-8 pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <FilterToggle schema={filterSchema} values={filters} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {catalogs.length > 1 && (
              <OptionSelect
                className="h-8 w-44"
                options={catalogs.map((c) => ({ value: String(c.id), label: `Katalog: ${c.name}` }))}
                value={String(catalog.id)}
                onChange={(value) => visit({ catalog_id: Number(value), warehouse_id: null, price_group_id: null })}
              />
            )}
            {priceGroups.length > 1 && (
              <OptionSelect
                className="h-8 w-44"
                options={priceGroups.map((g) => ({ value: String(g.id), label: `Cena: ${g.name}` }))}
                value={String(view.price_group_id)}
                onChange={(value) => visit({ price_group_id: Number(value), page: pagination.page }, { keepSelection: true })}
              />
            )}
            {multiWarehouse && (
              <OptionSelect
                className="h-8 w-52"
                options={[{ value: ALL, label: "Stan: łącznie" }, ...warehouses.map((w) => ({ value: String(w.id), label: `Stan: ${w.name}` }))]}
                value={view.warehouse_id ? String(view.warehouse_id) : ALL}
                onChange={(value) => visit({ warehouse_id: value === ALL ? null : Number(value), page: pagination.page }, { keepSelection: true })}
              />
            )}
          </div>
        </div>
        {filtersOpen ? (
          <FilterPanel schema={filterSchema} values={filters} onApply={(values) => visit(values)} />
        ) : (
          <FilterChips
            schema={filterSchema}
            values={filters}
            onRemove={(params) => visit(Object.fromEntries(params.map((param) => [param, ""])))}
            onClear={() => visit(emptyFilterValues(filterSchema))}
          />
        )}
      </div>

      <Pagination
        pagination={pagination}
        noun={productsWord(pagination.total)}
        onPage={(page) => visit({ page }, { keepSelection: true })}
        onPer={(per) => visit({ per }, { keepSelection: true })}
      />

      <Card className="gap-0 py-0">
        {pageSelected && pagination.total > pageIds.length && (
          <div className="bg-muted/50 border-b px-4 py-2 text-center text-sm">
            {selection.allMatching ? (
              <>
                Zaznaczono wszystkie {pagination.total} {productsWord(pagination.total)} pasujące do wyszukiwania.{" "}
                <button type="button" className="font-medium underline underline-offset-4" onClick={selection.clear}>
                  Wyczyść zaznaczenie
                </button>
              </>
            ) : (
              <>
                Zaznaczono {pageIds.length} {productsWord(pageIds.length)} na tej stronie.{" "}
                <button type="button" className="font-medium underline underline-offset-4" onClick={() => selection.setAllMatching(true)}>
                  Zaznacz wszystkie {pagination.total} pasujące
                </button>
              </>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
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
                <SortHead field="name">Nazwa</SortHead>
                <SortHead field="sku">SKU</SortHead>
                <TableHead>EAN</TableHead>
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
                  <TableCell colSpan={8} className="h-48">
                    <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                      <ShirtIcon className="size-6" />
                      <p className="text-foreground font-medium">{filtered ? "Brak produktów spełniających kryteria" : "Brak produktów w tym katalogu"}</p>
                      {filtered ? (
                        <Button
                          variant="outline"
                          size="sm"
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
                      <TableRow
                        data-state={selected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => router.visit(`/inventory/products/${product.id}/edit`)}
                      >
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox aria-label={`Zaznacz ${product.name}`} checked={selected} onCheckedChange={() => selection.toggle(product.id)} />
                        </TableCell>
                        <TableCell className="px-0">
                          {hasVariants && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={open ? "Zwiń warianty" : "Rozwiń warianty"}
                              aria-expanded={open}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(product.id)
                              }}
                            >
                              <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/inventory/products/${product.id}/edit`} onClick={(e) => e.stopPropagation()}>
                            {product.name}
                          </Link>
                          {hasVariants && (
                            <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal" title="Produkt z wariantami">
                              <LayersIcon className="size-3.5" />
                              {product.variants.length}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{product.ean ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{product.price ?? "—"}</TableCell>
                        <TableCell className={cn("text-right font-medium tabular-nums", product.stock <= 0 && "text-destructive")}>{product.stock}</TableCell>
                        <TableCell className="pr-4">
                          <StatusBadge status={product.status} label={statuses[product.status]} />
                        </TableCell>
                      </TableRow>
                      {open &&
                        product.variants.map((variant) => (
                          <TableRow key={variant.id} className="bg-muted/30 cursor-pointer" onClick={() => router.visit(`/inventory/variants/${variant.id}/edit`)}>
                            <TableCell className="pl-4" />
                            <TableCell className="px-0" />
                            <TableCell className="pl-6">
                              <Link href={`/inventory/variants/${variant.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                <span className="text-muted-foreground">↳ </span>
                                {variant.name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{variant.sku ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{variant.ean ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{variant.price ?? "—"}</TableCell>
                            <TableCell className={cn("text-right tabular-nums", variant.stock <= 0 && "text-destructive")}>{variant.stock}</TableCell>
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

      <BulkActionBar count={selectedCount} onClear={selection.clear}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
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
          description="Produkty z wariantami zostaną usunięte razem z wariantami. Produkty z towarem, historią magazynową lub zamówieniami zostaną pominięte – takie archiwizuj."
          onConfirm={() => bulk({ operation: "delete" })}
          trigger={
            <Button variant="destructive" size="sm">
              <Trash2Icon />
              Usuń
            </Button>
          }
        />
      </BulkActionBar>
    </>
  )
}
