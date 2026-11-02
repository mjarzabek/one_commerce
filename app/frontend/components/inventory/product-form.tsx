import { useForm } from "@inertiajs/react"

import { OptionSelect } from "@/components/inventory/option-select"
import { errorText, type CatalogOption, type FormErrors, type PriceGroup, type PriceInputs } from "@/components/inventory/types"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export type ProductFormData = {
  id: number | null
  catalog_id: number
  name: string
  sku: string
  ean: string
  description: string
  status: string
  tax_rate: string
  prices: PriceInputs
  hasVariants: boolean
}

export type ProductFormProps = {
  product: ProductFormData
  catalog: CatalogOption
  catalogs: CatalogOption[]
  priceGroups: PriceGroup[]
  // Grupy cenowe, z których korzysta każdy katalog: { catalog_id: [price_group_id, …] }.
  catalogPriceGroups: Record<string, number[]>
  statuses: Record<string, string>
  taxRates: string[]
}

// Grupy cenowe katalogu wybranego w formularzu.
export const priceGroupsForCatalog = ({ priceGroups, catalogPriceGroups }: Pick<ProductFormProps, "priceGroups" | "catalogPriceGroups">, catalogId: number) =>
  priceGroups.filter((group) => (catalogPriceGroups[String(catalogId)] ?? []).includes(group.id))

// Formularz produktu wspólny dla zakładek Ogólne i Ceny; zapis wraca na bieżącą zakładkę.
export function useProductForm(product: ProductFormData) {
  const form = useForm({ ...product })

  const save = (tab: string) => {
    form.transform(({ id: _id, hasVariants, prices, ...data }) => ({
      product: hasVariants ? data : { ...data, price_inputs: prices },
    }))
    const query = tab === "general" ? "" : `?tab=${tab}`
    const options = { preserveScroll: true, preserveState: "errors" as const }
    if (product.id) form.patch(`/inventory/products/${product.id}${query}`, options)
    else form.post(`/inventory/products${query}`, options)
  }

  const errors = form.errors as FormErrors
  const errorKeys = Object.keys(errors).filter((key) => errors[key])

  return {
    form,
    save,
    errors,
    generalHasErrors: errorKeys.some((key) => !key.startsWith("prices.")),
    pricesHaveErrors: errorKeys.some((key) => key.startsWith("prices.")),
  }
}

export type ProductFormState = ReturnType<typeof useProductForm>

// Zakładka „Ogólne”: nazwa, SKU, EAN, opis, katalog, VAT, status.
export function ProductGeneralFields({
  state,
  product,
  catalogs,
  statuses,
  taxRates,
}: { state: ProductFormState } & Pick<ProductFormProps, "product" | "catalogs" | "statuses" | "taxRates">) {
  const { form, errors } = state
  const error = (key: string) => errorText(errors, key)

  return (
    <Card>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={!!error("name")}>
            <FieldLabel htmlFor="name">Nazwa</FieldLabel>
            <Input id="name" value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} aria-invalid={!!error("name")} autoFocus={!product.id} />
            <FieldError>{error("name")}</FieldError>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!error("sku")}>
              <FieldLabel htmlFor="sku">SKU</FieldLabel>
              <Input id="sku" value={form.data.sku} onChange={(e) => form.setData("sku", e.target.value)} aria-invalid={!!error("sku")} />
              {product.hasVariants && <FieldDescription>Opcjonalne – warianty mają własne SKU.</FieldDescription>}
              <FieldError>{error("sku")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ean">EAN</FieldLabel>
              <Input id="ean" value={form.data.ean} onChange={(e) => form.setData("ean", e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="description">Opis</FieldLabel>
            <Textarea id="description" rows={4} value={form.data.description} onChange={(e) => form.setData("description", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="catalog">Katalog</FieldLabel>
              <OptionSelect
                id="catalog"
                options={catalogs.map((catalog) => ({ value: String(catalog.id), label: catalog.name }))}
                value={String(form.data.catalog_id)}
                onChange={(value) => form.setData("catalog_id", Number(value))}
                disabled={!!product.id}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tax_rate">Stawka VAT</FieldLabel>
              <OptionSelect
                id="tax_rate"
                options={taxRates.map((rate) => ({ value: rate, label: `${rate}%` }))}
                value={form.data.tax_rate}
                onChange={(value) => form.setData("tax_rate", value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <OptionSelect
                id="status"
                options={Object.entries(statuses).map(([value, label]) => ({ value, label }))}
                value={form.data.status}
                onChange={(value) => form.setData("status", value)}
              />
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

export type { PriceGroup }
