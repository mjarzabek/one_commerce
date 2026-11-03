import { Head } from "@inertiajs/react"
import { BookmarkIcon, HistoryIcon, TagsIcon, Trash2Icon } from "lucide-react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { PricesPanel } from "@/components/inventory/prices-panel"
import { HistoryPanel, ReservationsPanel, StockFields } from "@/components/inventory/stock-panels"
import { catalogCrumbs, stockInputs, type ProductActivity, type ProductStock } from "@/components/inventory/types"
import { useVariantForm, VariantGeneralFields, type VariantFormProps } from "@/components/inventory/variant-form"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { Button } from "@/components/ui/button"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["variant", "history", "reservations"] as const
type Tab = (typeof TABS)[number]

type Props = VariantFormProps & { stock: ProductStock; activity: ProductActivity; reservationsEnabled: boolean }

// Karta wariantu: Wariant (dane, ceny, stan - jeden zapis), Historia stanów i cen, Rezerwacje (gdy włączone).
export default function InventoryVariantEdit({ stock, activity, reservationsEnabled, ...props }: Props) {
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
          <ConfirmDelete
            title={`Usunąć wariant „${variant.name}”?`}
            description="Usuwa wariant razem ze stanem, historią i rezerwacjami. Zamówienia z tym wariantem zostają."
            url={`/inventory/variants/${variant.id}`}
            trigger={
              <Button variant="ghost">
                <Trash2Icon />
                Usuń wariant
              </Button>
            }
          />
        }
      />

      <TabbedCard
        label="Sekcje wariantu"
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        items={[
          { value: "variant", label: "Wariant", icon: TagsIcon, error: state.hasErrors },
          ...(showReservations
            ? [{ value: "reservations", label: activity.reservations.length > 0 ? `Rezerwacje (${activity.reservations.length})` : "Rezerwacje", icon: BookmarkIcon }]
            : []),
          { value: "history", label: "Historia", icon: HistoryIcon },
        ]}
      >
        {tab === "variant" && (
          <>
            <VariantGeneralFields state={state} {...props} />
            <PricesPanel
              priceGroups={props.priceGroups}
              value={state.form.data.prices}
              onChange={(prices) => state.form.setData("prices", prices)}
              errors={state.errors}
              taxRate={{ value: parent.taxRate, inherited: true }}
            />
            <StockFields stock={stock} value={state.form.data.stock} onChange={(value) => state.form.setData("stock", value)} errors={state.errors} />
          </>
        )}
        {tab === "history" && <HistoryPanel activity={activity} />}
        {tab === "reservations" && <ReservationsPanel reservations={activity.reservations} />}
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
