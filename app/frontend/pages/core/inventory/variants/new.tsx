import { Head } from "@inertiajs/react"

import { PricesPanel } from "@/components/inventory/prices-panel"
import { catalogCrumbs } from "@/components/inventory/types"
import { useVariantForm, VariantGeneralFields, type VariantFormProps } from "@/components/inventory/variant-form"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"

export default function InventoryVariantNew(props: VariantFormProps) {
  const { parent, catalog } = props
  const state = useVariantForm(props)

  return (
    <>
      <Head title={`Nowy wariant · ${parent.name}`} />
      <PageBar breadcrumbs={[...catalogCrumbs(catalog), { label: parent.name, href: `/inventory/products/${parent.id}/edit?tab=variants` }, { label: "Nowy wariant" }]} />

      <div className="flex flex-col gap-4">
        <VariantGeneralFields state={state} {...props} />
        <PricesPanel
          priceGroups={props.priceGroups}
          value={state.form.data.prices}
          onChange={(prices) => state.form.setData("prices", prices)}
          errors={state.errors}
          taxRate={{ value: parent.taxRate, inherited: true }}
        />
      </div>

      <p className="text-muted-foreground text-sm">Stan w magazynach uzupełnisz po dodaniu wariantu.</p>
      <SaveBar visible processing={state.form.processing} label="Dodaj wariant" onSave={() => state.save("variant")} />
    </>
  )
}
