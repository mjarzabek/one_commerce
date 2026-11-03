import { Head } from "@inertiajs/react"
import { FileTextIcon, TagsIcon } from "lucide-react"

import { PricesPanel } from "@/components/inventory/prices-panel"
import { ProductImagesCard } from "@/components/inventory/product-images"
import {
  priceGroupsForCatalog,
  ProductBasicsCard,
  ProductDescriptionsCard,
  ProductDimensionsCard,
  ProductParametersCard,
  useProductForm,
  type ProductFormProps,
} from "@/components/inventory/product-form"
import { catalogCrumbs } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { SaveBar } from "@/components/save-bar"
import { TabbedCard } from "@/components/tabbed-card"
import { useTabParam } from "@/hooks/use-tab-param"

const TABS = ["product", "sales"] as const

export default function InventoryProductNew(props: ProductFormProps) {
  const state = useProductForm(props.product)
  const [tab, setTab] = useTabParam(TABS, "product")

  return (
    <>
      <Head title="Nowy produkt" />
      <PageBar breadcrumbs={[...catalogCrumbs(props.catalog), { label: "Nowy produkt" }]} />

      <TabbedCard
        label="Sekcje produktu"
        value={tab}
        onChange={(value) => setTab(value as (typeof TABS)[number])}
        items={[
          { value: "product", label: "Karta produktu", icon: FileTextIcon, error: state.productHasErrors },
          { value: "sales", label: "Sprzedaż", icon: TagsIcon, error: state.salesHaveErrors },
        ]}
      >
        {tab === "product" && (
          <>
            <ProductBasicsCard state={state} {...props} />
            <ProductImagesCard productId={null} images={[]} />
            <ProductDescriptionsCard state={state} />
            <ProductParametersCard state={state} />
            <ProductDimensionsCard state={state} />
          </>
        )}
        {tab === "sales" && (
          <PricesPanel
            priceGroups={priceGroupsForCatalog(props, state.form.data.catalog_id)}
            value={state.form.data.prices}
            onChange={(prices) => state.form.setData("prices", prices)}
            errors={state.errors}
            taxRate={{ value: state.form.data.tax_rate, options: props.taxRates, onChange: (value) => state.form.setData("tax_rate", value) }}
          />
        )}
      </TabbedCard>

      <SaveBar visible processing={state.form.processing} label="Dodaj produkt" onSave={() => state.save(tab)} />
    </>
  )
}
