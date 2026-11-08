import { Head } from "@inertiajs/react"
import { FileTextIcon, TagsIcon } from "lucide-react"

import { catalogCrumbs } from "@/components/inventory/types"
import { useVariantForm, VariantContent, VariantPrices, type VariantFormProps } from "@/components/inventory/variant-form"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["variant", "sales"] as const

// Nowy wariant: te same zakładki co nowy produkt. Treści, VAT i wymiary dziedziczy z produktu głównego.
export default function InventoryVariantNew(props: VariantFormProps) {
  const { parent, catalog } = props
  const state = useVariantForm(props)
  const [tab, setTab] = useTabParam(TABS, "variant")

  return (
    <>
      <Head title={`Nowy wariant · ${parent.name}`} />
      <PageBar breadcrumbs={[...catalogCrumbs(catalog), { label: parent.name, href: `/inventory/products/${parent.id}/edit?tab=variants` }, { label: "Nowy wariant" }]} />

      <TabbedCard
        label="Sekcje wariantu"
        value={tab}
        onChange={(value) => setTab(value as (typeof TABS)[number])}
        items={[
          { value: "variant", label: "Karta wariantu", icon: FileTextIcon, error: state.productHasErrors },
          { value: "sales", label: "Sprzedaż", icon: TagsIcon, error: state.salesHaveErrors },
        ]}
      >
        {tab === "variant" && <VariantContent state={state} {...props} />}
        {tab === "sales" && <VariantPrices state={state} {...props} />}
      </TabbedCard>

      <SaveBar visible processing={state.form.processing} label="Dodaj wariant" onSave={() => state.save(tab, "variant")} />
    </>
  )
}
