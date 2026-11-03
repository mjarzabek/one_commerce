import { Head } from "@inertiajs/react"
import { BoxesIcon, FileTextIcon, HistoryIcon, TagsIcon, Trash2Icon } from "lucide-react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { PricesPanel } from "@/components/inventory/prices-panel"
import { MovementsPanel, StockPanel } from "@/components/inventory/stock-panels"
import { catalogCrumbs, type ProductStock } from "@/components/inventory/types"
import { useVariantForm, VariantGeneralFields, type VariantFormProps } from "@/components/inventory/variant-form"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { Button } from "@/components/ui/button"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["general", "prices", "stock", "history"] as const
type Tab = (typeof TABS)[number]

type Props = VariantFormProps & { stock: ProductStock }

// Karta wariantu w zakładkach: Ogólne, Ceny, Stan, Historia.
export default function InventoryVariantEdit({ stock, ...props }: Props) {
  const { variant, parent, catalog } = props
  const state = useVariantForm(props)
  const [tab, setTab] = useTabParam<Tab>(TABS, "general")
  const label = `${parent.name} - ${variant.name}`

  return (
    <>
      <Head title={label} />
      <PageBar
        breadcrumbs={[...catalogCrumbs(catalog), { label: parent.name, href: `/inventory/products/${parent.id}/edit?tab=variants` }, { label: variant.name }]}
        actions={
          <ConfirmDelete
            title={`Usunąć wariant „${variant.name}”?`}
            description="Można usunąć tylko wariant bez historii magazynowej i zamówień."
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
        onChange={(value) => setTab(value as (typeof TABS)[number])}
        items={[
          { value: "general", label: "Ogólne", icon: FileTextIcon, error: state.generalHasErrors },
          { value: "prices", label: "Ceny", icon: TagsIcon, error: state.pricesHaveErrors },
          { value: "stock", label: "Stan", icon: BoxesIcon },
          { value: "history", label: "Historia", icon: HistoryIcon },
        ]}
      >

      {tab === "general" && <VariantGeneralFields state={state} {...props} />}
      {tab === "prices" && <PricesPanel priceGroups={props.priceGroups} value={state.form.data.prices} onChange={(prices) => state.form.setData("prices", prices)} errors={state.errors} />}
      {tab === "stock" && <StockPanel productId={variant.id!} stock={stock} />}
      {tab === "history" && <MovementsPanel stock={stock} />}

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
