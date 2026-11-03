import { useForm } from "@inertiajs/react"

import { errorText, type FormErrors, type PriceGroup, type PriceInputs, type StockInputs } from "@/components/inventory/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type VariantFormProps = {
  variant: { id: number | null; name: string; sku: string; ean: string; prices: PriceInputs }
  parent: { id: number; name: string; sku: string | null; taxRate: string }
  catalog: { id: number; name: string }
  priceGroups: PriceGroup[]
}

// Formularz wariantu: dane, ceny i stan (po dodaniu) - jeden zapis; wraca na bieżącą zakładkę.
export function useVariantForm({ variant, parent }: Pick<VariantFormProps, "variant" | "parent">, stock: StockInputs = {}) {
  const form = useForm({ ...variant, stock })

  const save = (tab: string, defaultTab = "variant") => {
    form.transform(({ id: _id, prices, stock, ...data }) => ({
      variant: { ...data, price_inputs: prices },
      ...(Object.keys(stock).length === 0 ? {} : { stock }),
    }))
    const query = tab === defaultTab ? "" : `?tab=${tab}`
    const options = { preserveScroll: true, preserveState: "errors" as const }
    if (variant.id) form.patch(`/inventory/variants/${variant.id}${query}`, options)
    else form.post(`/inventory/products/${parent.id}/variants${query}`, options)
  }

  const errors = form.errors as FormErrors

  return { form, save, errors, hasErrors: Object.values(errors).some(Boolean) }
}

export type VariantFormState = ReturnType<typeof useVariantForm>

// Dane wariantu: nazwa wariantu (np. „M”, „czarny”), SKU, EAN.
export function VariantGeneralFields({ state, variant, parent }: { state: VariantFormState } & Pick<VariantFormProps, "variant" | "parent">) {
  const { form, errors } = state
  const error = (key: string) => errorText(errors, key)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dane wariantu</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldError>{error("base")}</FieldError>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!error("name")}>
              <FieldLabel htmlFor="name">Wariant</FieldLabel>
              <Input
                id="name"
                placeholder="np. M, czarny"
                value={form.data.name}
                onChange={(e) => form.setData("name", e.target.value)}
                aria-invalid={!!error("name")}
                autoFocus={!variant.id}
              />
              <FieldError>{error("name")}</FieldError>
            </Field>
            <Field data-invalid={!!error("sku")}>
              <FieldLabel htmlFor="sku">SKU</FieldLabel>
              <Input
                id="sku"
                placeholder={parent.sku ? `np. ${parent.sku}-M` : undefined}
                value={form.data.sku}
                onChange={(e) => form.setData("sku", e.target.value)}
                aria-invalid={!!error("sku")}
              />
              <FieldError>{error("sku")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ean">EAN</FieldLabel>
              <Input id="ean" value={form.data.ean} onChange={(e) => form.setData("ean", e.target.value)} />
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
