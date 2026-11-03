import { Head, Link, router } from "@inertiajs/react"
import {
  BookmarkIcon,
  CopyIcon,
  FileTextIcon,
  HistoryIcon,
  LayersIcon,
  LinkIcon,
  PlusIcon,
  StoreIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { ProductImagesCard } from "@/components/inventory/product-images"
import { PricesPanel, TaxRateField, type TaxRateControl } from "@/components/inventory/prices-panel"
import {
  priceGroupsForCatalog,
  ProductBasicsCard,
  ProductDescriptionsCard,
  ProductDimensionsCard,
  ProductParametersCard,
  useProductForm,
  type ProductFormProps,
} from "@/components/inventory/product-form"
import { HistoryPanel, ReservationsPanel, StockFields } from "@/components/inventory/stock-panels"
import {
  catalogCrumbs,
  stockInputs,
  variantsWord,
  type CatalogOption,
  type ProductActivity,
  type ProductImage,
  type ProductStock,
} from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTabParam } from "@/hooks/use-tab-param"
import { cn } from "@/lib/utils"

type VariantRow = {
  id: number
  name: string
  sku: string | null
  ean: string | null
  price: string | null
  available: number
  levels: Record<string, { on_hand: number; reserved: number }>
}

type Props = ProductFormProps & {
  stock?: ProductStock
  variants?: VariantRow[]
  warehouses?: CatalogOption[]
  images: ProductImage[]
  activity: ProductActivity
  reservationsEnabled: boolean
  summary: { available: number; price: string | null; priceGroup: string }
}

const TABS = ["product", "sales", "variants", "history", "reservations", "channels"] as const
type Tab = (typeof TABS)[number]

// Karta produktu: treść (Karta produktu), Sprzedaż (ceny, VAT, stan - tylko produkt prosty), Warianty, Historia stanów
// i cen, Rezerwacje (gdy włączone) i Kanały. Produkt z wariantami nie ma własnych cen ani stanu - VAT ustawia się
// w zakładce Warianty. Dane, ceny i stan zapisuje jeden pasek; zdjęcia zapisują się od razu.
export default function InventoryProductEdit({ stock, variants = [], warehouses = [], images, activity, reservationsEnabled, summary, ...props }: Props) {
  const { product, catalog } = props
  const state = useProductForm(product, stockInputs(stock))
  const hasVariants = product.hasVariants
  const [requestedTab, setTab] = useTabParam<Tab>(TABS, "product")
  const tab = hasVariants && requestedTab === "sales" ? "variants" : requestedTab
  const [deleting, setDeleting] = useState(false)
  const showReservations = reservationsEnabled || activity.reservations.length > 0
  const taxRate: TaxRateControl = { value: state.form.data.tax_rate, options: props.taxRates, onChange: (value) => state.form.setData("tax_rate", value) }

  return (
    <>
      <Head title={product.name} />
      <PageBar
        breadcrumbs={[...catalogCrumbs(catalog), { label: product.name }]}
        actions={
          <>
            <RowActions
              size="icon"
              label="Akcje produktu"
              actions={[
                { label: "Duplikuj", icon: CopyIcon, onSelect: () => router.post(`/inventory/products/${product.id}/duplicate`) },
                { label: "Usuń produkt", icon: Trash2Icon, destructive: true, onSelect: () => setDeleting(true) },
              ]}
            />
            <ConfirmDelete
              open={deleting}
              onOpenChange={setDeleting}
              title={`Usunąć produkt „${product.name}”?`}
              description={`Usuwa produkt${hasVariants ? " razem z wariantami" : ""}, zdjęciami, stanem${summary.available > 0 ? ` (${summary.available} szt.)` : ""} i historią. Zamówienia z tym produktem zostają. Tej operacji nie można cofnąć.`}
              url={`/inventory/products/${product.id}`}
            />
          </>
        }
      />

      <TabbedCard
        label="Sekcje produktu"
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: "product", label: "Karta produktu", icon: FileTextIcon, error: state.productHasErrors },
          ...(hasVariants
            ? [{ value: "variants", label: `Warianty (${variants.length})`, icon: LayersIcon, error: state.salesHaveErrors }]
            : [
                { value: "sales", label: "Sprzedaż", icon: TagsIcon, error: state.salesHaveErrors },
                { value: "variants", label: "Warianty", icon: LayersIcon },
              ]),
          ...(showReservations
            ? [{ value: "reservations", label: activity.reservations.length > 0 ? `Rezerwacje (${activity.reservations.length})` : "Rezerwacje", icon: BookmarkIcon }]
            : []),
          { value: "channels", label: "Kanały", icon: StoreIcon },
          { value: "history", label: "Historia", icon: HistoryIcon },
        ]}
      >
        {tab === "product" && (
          <>
            <ProductBasicsCard state={state} {...props} />
            <ProductImagesCard productId={product.id} images={images} />
            <ProductDescriptionsCard state={state} />
            <ProductParametersCard state={state} />
            <ProductDimensionsCard state={state} />
          </>
        )}

        {tab === "sales" && !hasVariants && (
          <>
            <PricesPanel
              priceGroups={priceGroupsForCatalog(props, state.form.data.catalog_id)}
              value={state.form.data.prices}
              onChange={(prices) => state.form.setData("prices", prices)}
              errors={state.errors}
              taxRate={taxRate}
            />
            {stock && <StockFields stock={stock} value={state.form.data.stock} onChange={(value) => state.form.setData("stock", value)} errors={state.errors} />}
          </>
        )}

        {tab === "variants" && !hasVariants && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <LayersIcon className="text-muted-foreground size-8" />
              <div className="flex max-w-md flex-col gap-1">
                <p className="font-medium">Ten produkt nie ma wariantów</p>
                <p className="text-muted-foreground text-sm">
                  Sprzedajesz go w kilku rozmiarach lub kolorach? Każdy wariant dostanie własne SKU, EAN, ceny i stan, a opis, zdjęcia i VAT zostają na
                  produkcie.
                  {summary.available > 0 && " Najpierw wyzeruj stan produktu w zakładce Sprzedaż."}
                </p>
              </div>
              <Link href={`/inventory/products/${product.id}/variants/new`} className={buttonVariants({ variant: "outline" })}>
                <PlusIcon />
                Dodaj wariant
              </Link>
            </CardContent>
          </Card>
        )}

        {tab === "variants" && hasVariants && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>VAT</CardTitle>
                <CardDescription>Stawka wspólna dla wszystkich wariantów. Ceny i stany ustawiasz na wariantach.</CardDescription>
              </CardHeader>
              <CardContent>
                <TaxRateField taxRate={taxRate} errors={state.errors} />
              </CardContent>
            </Card>
            <VariantsTable productId={product.id!} variants={variants} warehouses={warehouses} priceGroup={summary.priceGroup} priceRange={summary.price} />
          </>
        )}

        {tab === "history" && <HistoryPanel activity={activity} />}

        {tab === "reservations" && <ReservationsPanel reservations={activity.reservations} />}

        {tab === "channels" && (
          <Card>
            <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <LinkIcon className="size-4 shrink-0" />
              Oferty Allegro i produkty w sklepach połączone z tym produktem pojawią się tutaj po podłączeniu kanałów w module MultiChannel.
            </CardContent>
          </Card>
        )}
      </TabbedCard>

      <SaveBar
        visible={state.form.isDirty}
        processing={state.form.processing}
        onSave={() => state.save(tab)}
        onDiscard={() => {
          state.form.reset()
          state.form.clearErrors()
        }}
      />
    </>
  )
}

// Warianty produktu z ceną (grupa domyślna) i stanem w każdym magazynie katalogu. Klik otwiera kartę wariantu.
// Wiersz „Razem” to wartości produktu głównego - wyliczone z wariantów, bez edycji.
function VariantsTable({
  productId,
  variants,
  warehouses,
  priceGroup,
  priceRange,
}: {
  productId: number
  variants: VariantRow[]
  warehouses: CatalogOption[]
  priceGroup: string
  priceRange: string | null
}) {
  const total = (pick: (level: VariantRow["levels"][string]) => number, warehouseId: number) =>
    variants.reduce((sum, variant) => sum + pick(variant.levels[String(warehouseId)]), 0)
  const available = variants.reduce((sum, variant) => sum + variant.available, 0)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Warianty</CardTitle>
        <CardDescription>Każdy wariant ma własne SKU, EAN, ceny i stan. Kliknij wariant, żeby go edytować.</CardDescription>
        <CardAction>
          <Link href={`/inventory/products/${productId}/variants/new`} className={buttonVariants({ size: "sm" })}>
            <PlusIcon />
            Dodaj wariant
          </Link>
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Wariant</TableHead>
              <TableHead>EAN</TableHead>
              <TableHead className="text-right">Cena · {priceGroup}</TableHead>
              {warehouses.map((warehouse) => (
                <TableHead key={warehouse.id} className="text-right">
                  {warehouse.name}
                </TableHead>
              ))}
              <TableHead className="bg-muted/40 pr-6 text-right">Dostępne</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => (
              <TableRow key={variant.id} className="cursor-pointer" onClick={() => router.visit(`/inventory/variants/${variant.id}/edit`)}>
                <TableCell className="pl-6">
                  <Link href={`/inventory/variants/${variant.id}/edit`} className="font-medium" onClick={(e) => e.stopPropagation()}>
                    {variant.name}
                  </Link>
                  {variant.sku && <span className="text-muted-foreground ml-2 text-xs">{variant.sku}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{variant.ean ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{variant.price ?? "-"}</TableCell>
                {warehouses.map((warehouse) => {
                  const level = variant.levels[String(warehouse.id)]
                  return (
                    <TableCell key={warehouse.id} className="text-right tabular-nums">
                      {level.on_hand}
                      {level.reserved > 0 && <span className="text-muted-foreground text-xs"> ({level.reserved} rez.)</span>}
                    </TableCell>
                  )
                })}
                <TableCell className={cn("bg-muted/40 pr-6 text-right font-medium tabular-nums", variant.available <= 0 && "text-destructive")}>
                  {variant.available}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-6" colSpan={2}>
                Razem · {variants.length} {variantsWord(variants.length)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{priceRange ?? "-"}</TableCell>
              {warehouses.map((warehouse) => {
                const reserved = total((level) => level.reserved, warehouse.id)
                return (
                  <TableCell key={warehouse.id} className="text-right tabular-nums">
                    {total((level) => level.on_hand, warehouse.id)}
                    {reserved > 0 && <span className="text-muted-foreground text-xs"> ({reserved} rez.)</span>}
                  </TableCell>
                )
              })}
              <TableCell className={cn("pr-6 text-right tabular-nums", available <= 0 && "text-destructive")}>{available}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Card>
  )
}
