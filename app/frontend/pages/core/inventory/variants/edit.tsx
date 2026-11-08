import { Head, router } from "@inertiajs/react"
import { BookmarkIcon, FileTextIcon, HistoryIcon, LinkIcon, StoreIcon, TagsIcon, Trash2Icon } from "lucide-react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { HistoryPanel, ReservationsPanel, StockFields } from "@/components/inventory/stock-panels"
import { catalogCrumbs, stockInputs, type ProductActivity, type ProductImage, type ProductStock } from "@/components/inventory/types"
import { useVariantForm, VariantContent, VariantPrices, type VariantFormProps } from "@/components/inventory/variant-form"
import { OptionSelect } from "@/components/option-select"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["variant", "sales", "history", "reservations", "channels"] as const
type Tab = (typeof TABS)[number]

type Props = VariantFormProps & {
  images: ProductImage[]
  stock: ProductStock
  activity: ProductActivity
  reservationsEnabled: boolean
  siblings: { id: number; name: string }[]
}

// Karta wariantu - te same zakładki co karta produktu: Karta wariantu (dane, zdjęcia, opisy, parametry, wymiary -
// z dziedziczeniem z produktu głównego), Sprzedaż (ceny, VAT, stan), Rezerwacje (gdy włączone), Kanały, Historia.
// Dane, ceny i stan zapisuje jeden pasek; zdjęcia zapisują się od razu.
export default function InventoryVariantEdit({ images, stock, activity, reservationsEnabled, siblings, ...props }: Props) {
  const { variant, parent, catalog } = props
  const state = useVariantForm(props, stockInputs(stock))
  const [tab, setTab] = useTabParam<Tab>(TABS, "variant")
  const label = `${parent.name} - ${variant.name}`
  const showReservations = reservationsEnabled || activity.reservations.length > 0

  return (
    <>
      <Head title={label} />
      <PageBar
        breadcrumbs={[...catalogCrumbs(catalog), { label: parent.name, href: `/inventory/products/${parent.id}/edit?tab=variants` }, { label: variant.name }]}
        actions={
          <>
            {siblings.length > 1 && (
              <OptionSelect
                label="Przejdź do wariantu"
                className="w-40"
                options={siblings.map((sibling) => ({ value: String(sibling.id), label: sibling.name }))}
                value={String(variant.id)}
                onChange={(id) => router.visit(`/inventory/variants/${id}/edit${tab === "variant" ? "" : `?tab=${tab}`}`)}
              />
            )}
            <ConfirmDelete
              title={`Usunąć wariant „${variant.name}”?`}
              description="Usuwa wariant razem z jego zdjęciami, stanem, historią i rezerwacjami. Zamówienia z tym wariantem zostają."
              url={`/inventory/variants/${variant.id}`}
              trigger={
                <Button variant="ghost">
                  <Trash2Icon />
                  Usuń wariant
                </Button>
              }
            />
          </>
        }
      />

      <TabbedCard
        label="Sekcje wariantu"
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: "variant", label: "Karta wariantu", icon: FileTextIcon, error: state.productHasErrors },
          { value: "sales", label: "Sprzedaż", icon: TagsIcon, error: state.salesHaveErrors },
          ...(showReservations
            ? [{ value: "reservations", label: activity.reservations.length > 0 ? `Rezerwacje (${activity.reservations.length})` : "Rezerwacje", icon: BookmarkIcon }]
            : []),
          { value: "channels", label: "Kanały", icon: StoreIcon },
          { value: "history", label: "Historia", icon: HistoryIcon },
        ]}
      >
        {tab === "variant" && <VariantContent state={state} images={images} {...props} />}
        {tab === "sales" && (
          <>
            <VariantPrices state={state} {...props} />
            <StockFields stock={stock} value={state.form.data.stock} onChange={(value) => state.form.setData("stock", value)} errors={state.errors} />
          </>
        )}
        {tab === "history" && <HistoryPanel activity={activity} />}
        {tab === "reservations" && <ReservationsPanel reservations={activity.reservations} />}
        {tab === "channels" && (
          <Card>
            <CardContent className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <LinkIcon className="size-4 shrink-0" />
              Oferty Allegro i produkty w sklepach połączone z tym wariantem pojawią się tutaj po podłączeniu kanałów w module MultiChannel.
            </CardContent>
          </Card>
        )}
      </TabbedCard>

      <SaveBar
        visible={state.form.isDirty}
        processing={state.form.processing}
        onSave={() => state.save(tab, "variant")}
        onDiscard={() => {
          state.form.reset()
          state.form.clearErrors()
        }}
      />
    </>
  )
}
