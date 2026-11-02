import { Head } from "@inertiajs/react"
import { FileTextIcon, TagsIcon } from "lucide-react"

import { PricesPanel } from "@/components/inventory/prices-panel"
import { priceGroupsForCatalog, ProductGeneralFields, useProductForm, type ProductFormProps } from "@/components/inventory/product-form"
import { SaveBar } from "@/components/inventory/save-bar"
import { catalogCrumbs } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { TabNav } from "@/components/tab-nav"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["general", "prices"] as const

export default function InventoryProductNew(props: ProductFormProps) {
  const state = useProductForm(props.product)
  const [tab, setTab] = useTabParam(TABS, "general")

  return (
    <>
      <Head title="Nowy produkt" />
      <PageBar breadcrumbs={[...catalogCrumbs(props.catalog), { label: "Nowy produkt" }]} />

      <TabNav
        label="Sekcje produktu"
        value={tab}
        onChange={(value) => setTab(value as (typeof TABS)[number])}
        items={[
          { value: "general", label: "Ogólne", icon: FileTextIcon, error: state.generalHasErrors },
          { value: "prices", label: "Ceny", icon: TagsIcon, error: state.pricesHaveErrors },
        ]}
      />

      {tab === "general" && <ProductGeneralFields state={state} {...props} />}
      {tab === "prices" && <PricesPanel priceGroups={priceGroupsForCatalog(props, state.form.data.catalog_id)} value={state.form.data.prices} onChange={(prices) => state.form.setData("prices", prices)} errors={state.errors} />}

      <p className="text-muted-foreground text-sm">Stan w magazynach i warianty (rozmiary, kolory) dodasz po zapisaniu produktu.</p>
      <SaveBar visible processing={state.form.processing} label="Dodaj produkt" onSave={() => state.save(tab)} />
    </>
  )
}
