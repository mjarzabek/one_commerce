import { PricesPanel } from "@/components/inventory/prices-panel"
import { ProductImagesCard } from "@/components/inventory/product-images"
import {
  ProductBasicsCard,
  ProductDescriptionsCard,
  ProductDimensionsCard,
  ProductParametersCard,
  useProductForm,
  type CategoryOption,
  type InheritedFields,
  type ProductFormData,
  type ProductFormState,
} from "@/components/inventory/product-form"
import type { CatalogOption, PriceGroup, ProductImage, StockInputs } from "@/components/inventory/types"

export type VariantFormProps = {
  variant: ProductFormData
  parent: { id: number; name: string; sku: string | null }
  // Wartości produktu głównego, które wariant dziedziczy, dopóki nie ustawi własnych.
  inherited: InheritedFields
  catalog: CatalogOption
  categories: CategoryOption[]
  priceGroups: PriceGroup[]
  statuses: Record<string, string>
  taxRates: string[]
}

// Formularz wariantu - ten sam co produktu (dane, treści, VAT, ceny, stan), zapisywany pod adresem wariantu.
export function useVariantForm({ variant, parent }: Pick<VariantFormProps, "variant" | "parent">, stock: StockInputs = {}) {
  return useProductForm(variant, stock, { kind: "variant", parentId: parent.id })
}

// Zakładka „Karta wariantu”: dane, zdjęcia (własne + produktu), opisy, parametry i wymiary z dziedziczeniem.
export function VariantContent({ state, images = [], ...props }: { state: ProductFormState; images?: ProductImage[] } & VariantFormProps) {
  const { variant, parent, inherited } = props
  return (
    <>
      <ProductBasicsCard state={state} product={variant} statuses={props.statuses} categories={props.categories} parent={parent} inherited={inherited} />
      <ProductImagesCard productId={variant.id} images={images} inherited={inherited.images} />
      <ProductDescriptionsCard state={state} inherited={inherited} />
      <ProductParametersCard state={state} inherited={inherited} />
      <ProductDimensionsCard state={state} inherited={inherited} />
    </>
  )
}

// Ceny i VAT wariantu (VAT domyślnie jak produkt główny).
export function VariantPrices({ state, priceGroups, taxRates, inherited }: { state: ProductFormState } & Pick<VariantFormProps, "priceGroups" | "taxRates" | "inherited">) {
  return (
    <PricesPanel
      priceGroups={priceGroups}
      value={state.form.data.prices}
      onChange={(prices) => state.form.setData("prices", prices)}
      errors={state.errors}
      taxRate={{ value: state.form.data.tax_rate, options: taxRates, onChange: (value) => state.form.setData("tax_rate", value), inherited: inherited.tax_rate }}
    />
  )
}
