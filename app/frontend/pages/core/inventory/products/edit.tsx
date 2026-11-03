import { Head, Link, router } from "@inertiajs/react"
import { BoxesIcon, FileTextIcon, HistoryIcon, LayersIcon, LinkIcon, PlusIcon, StoreIcon, TagsIcon, Trash2Icon } from "lucide-react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { PricesPanel } from "@/components/inventory/prices-panel"
import { priceGroupsForCatalog, ProductGeneralFields, useProductForm, type ProductFormProps } from "@/components/inventory/product-form"
import { MovementsPanel, StockPanel } from "@/components/inventory/stock-panels"
import { catalogCrumbs, type CatalogOption, type ProductStock } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  summary: { available: number; price: string | null; priceGroup: string }
}

const TABS = ["general", "prices", "variants", "stock", "history", "marketplace"] as const
type Tab = (typeof TABS)[number]

// Karta produktu w zakładkach. Produkt prosty: Ogólne, Ceny, Warianty, Stan, Historia, Marketplace.
// Produkt z wariantami: Ogólne, Warianty, Stan (wariant × magazyn), Marketplace - ceny i stany są na wariantach.
export default function InventoryProductEdit({ stock, variants = [], warehouses = [], summary, ...props }: Props) {
  const { product, catalog } = props
  const state = useProductForm(product)
  const [tab, setTab] = useTabParam<Tab>(TABS, "general")
  const hasVariants = product.hasVariants

  return (
    <>
      <Head title={product.name} />
      <PageBar
        breadcrumbs={[...catalogCrumbs(catalog), { label: product.name }]}
        actions={
          <ConfirmDelete
            title={`Usunąć produkt „${product.name}”?`}
            description="Usuwa produkt razem z wariantami. Produktu z towarem, historią magazynową lub zamówieniami nie można usunąć - zmień mu status na „Zarchiwizowany”."
            url={`/inventory/products/${product.id}`}
            trigger={
              <Button variant="ghost">
                <Trash2Icon />
                Usuń produkt
              </Button>
            }
          />
        }
      />

      <TabbedCard
        label="Sekcje produktu"
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: "general", label: "Ogólne", icon: FileTextIcon, error: state.generalHasErrors },
          ...(hasVariants ? [] : [{ value: "prices", label: "Ceny", icon: TagsIcon, error: state.pricesHaveErrors }]),
          { value: "variants", icon: LayersIcon, label: hasVariants ? `Warianty (${variants.length})` : "Warianty" },
          { value: "stock", label: "Stan", icon: BoxesIcon },
          ...(hasVariants ? [] : [{ value: "history", label: "Historia", icon: HistoryIcon }]),
          { value: "marketplace", label: "Marketplace", icon: StoreIcon },
        ]}
      >

      {tab === "general" && <ProductGeneralFields state={state} {...props} />}

      {tab === "prices" && !hasVariants && (
        <PricesPanel priceGroups={priceGroupsForCatalog(props, state.form.data.catalog_id)} value={state.form.data.prices} onChange={(prices) => state.form.setData("prices", prices)} errors={state.errors} />
      )}

      {tab === "variants" && hasVariants && (
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Warianty</CardTitle>
            <CardDescription>Każdy wariant ma własne SKU, EAN, ceny i stan. Kliknij wariant, żeby go edytować.</CardDescription>
            <CardAction>
              <Link href={`/inventory/products/${product.id}/variants/new`} className={buttonVariants()}>
                <PlusIcon />
                Dodaj wariant
              </Link>
            </CardAction>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Wariant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead className="pr-6 text-right">Stan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id} className="cursor-pointer" onClick={() => router.visit(`/inventory/variants/${variant.id}/edit`)}>
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/inventory/variants/${variant.id}/edit`} onClick={(e) => e.stopPropagation()}>
                      {variant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{variant.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{variant.ean ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{variant.price ?? "-"}</TableCell>
                  <TableCell className={cn("pr-6 text-right font-medium tabular-nums", variant.available <= 0 && "text-destructive")}>{variant.available}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "variants" && !hasVariants && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <LayersIcon className="text-muted-foreground size-6" />
            <div className="space-y-1">
              <p className="font-medium">Produkt nie ma wariantów</p>
              <p className="text-muted-foreground max-w-md text-sm">
                Dodaj warianty, jeśli sprzedajesz go w kilku rozmiarach lub kolorach. Każdy wariant dostanie własne SKU, EAN, ceny i stan.
                {summary.available > 0 && " Najpierw wyzeruj stan produktu w zakładce „Stan”."}
              </p>
            </div>
            <Link href={`/inventory/products/${product.id}/variants/new`} className={buttonVariants({ variant: "outline" })}>
              <PlusIcon />
              Dodaj wariant
            </Link>
          </CardContent>
        </Card>
      )}

      {tab === "stock" && stock && <StockPanel productId={product.id!} stock={stock} />}

      {tab === "stock" && !stock && (
        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Wariant</TableHead>
                  {warehouses.map((warehouse) => (
                    <TableHead key={warehouse.id} className="text-right">
                      {warehouse.name}
                    </TableHead>
                  ))}
                  <TableHead className="bg-muted/40 pr-6 text-right">Dostępne łącznie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id} className="cursor-pointer" onClick={() => router.visit(`/inventory/variants/${variant.id}/edit?tab=stock`)}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{variant.name}</span> <span className="text-muted-foreground text-xs">{variant.sku}</span>
                    </TableCell>
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
            </Table>
          </div>
          <p className="text-muted-foreground border-t px-6 py-2 text-xs">Kliknij wariant, żeby zmienić jego stan.</p>
        </Card>
      )}

      {tab === "history" && stock && <MovementsPanel stock={stock} />}

      {tab === "marketplace" && (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <LinkIcon className="size-4 shrink-0" />
            Oferty Allegro i produkty w sklepach połączone z tym produktem pojawią się tutaj po podłączeniu kanałów w module MultiChannel.
          </CardContent>
        </Card>
      )}

      </TabbedCard>

      {/* Zakładka „Stan” ma własny pasek zapisu stanów. */}
      <SaveBar
        visible={state.form.isDirty && tab !== "stock"}
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
