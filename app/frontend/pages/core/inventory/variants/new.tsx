import { Head } from "@inertiajs/react"
import { FileTextIcon, TagsIcon } from "lucide-react"

import { PricesPanel } from "@/components/inventory/prices-panel"
import { SaveBar } from "@/components/inventory/save-bar"
import { catalogCrumbs } from "@/components/inventory/types"
import { useVariantForm, VariantGeneralFields, type VariantFormProps } from "@/components/inventory/variant-form"
import { PageBar } from "@/components/page-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["general", "prices"] as const

export default function InventoryVariantNew(props: VariantFormProps) {
  const { parent, catalog } = props
  const state = useVariantForm(props)
  const [tab, setTab] = useTabParam(TABS, "general")

  return (
    <>
      <Head title={`Nowy wariant · ${parent.name}`} />
      <PageBar breadcrumbs={[...catalogCrumbs(catalog), { label: parent.name, href: `/inventory/products/${parent.id}/edit?tab=variants` }, { label: "Nowy wariant" }]} />

      <TabbedCard
        label="Sekcje wariantu"
        value={tab}
        onChange={(value) => setTab(value as (typeof TABS)[number])}
        items={[
          { value: "general", label: "Ogólne", icon: FileTextIcon, error: state.generalHasErrors },
          { value: "prices", label: "Ceny", icon: TagsIcon, error: state.pricesHaveErrors },
        ]}
      >

      {tab === "general" && <VariantGeneralFields state={state} {...props} />}
      {tab === "prices" && <PricesPanel priceGroups={props.priceGroups} value={state.form.data.prices} onChange={(prices) => state.form.setData("prices", prices)} errors={state.errors} />}

      </TabbedCard>

      <SaveBar visible processing={state.form.processing} label="Dodaj wariant" onSave={() => state.save(tab)} />
    </>
  )
}
