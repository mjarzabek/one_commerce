import { useForm } from "@inertiajs/react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { OptionSelect } from "@/components/option-select"
import { errorText, type CatalogOption, type FormErrors, type PriceGroup, type PriceInputs, type StockInputs } from "@/components/inventory/types"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ProductParameter = { name: string; value: string }

export type ProductFormData = {
  id: number | null
  catalog_id: number
  name: string
  sku: string
  ean: string
  description: string
  description_extra_1: string
  description_extra_2: string
  description_extra_3: string
  parameters: ProductParameter[]
  status: string
  tax_rate: string
  length_cm: string
  width_cm: string
  height_cm: string
  weight_kg: string
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
  // Statusy do wyboru w formularzu (Szkic, Aktywny).
  statuses: Record<string, string>
  taxRates: string[]
}

// Grupy cenowe katalogu wybranego w formularzu.
export const priceGroupsForCatalog = ({ priceGroups, catalogPriceGroups }: Pick<ProductFormProps, "priceGroups" | "catalogPriceGroups">, catalogId: number) =>
  priceGroups.filter((group) => (catalogPriceGroups[String(catalogId)] ?? []).includes(group.id))

// Pola zakładki „Sprzedaż” (przy produkcie z wariantami VAT jest w zakładce „Warianty”) - po nich wiadomo, na której
// zakładce są błędy.
const SALES_FIELDS = ["tax_rate"]
const isSalesError = (key: string) => key.startsWith("prices.") || key.startsWith("stock.") || SALES_FIELDS.includes(key)

// Formularz karty produktu: dane, treści, ceny i stan (produkt prosty) - jeden zapis; wraca na bieżącą zakładkę.
export function useProductForm(product: ProductFormData, stock: StockInputs = {}) {
  const form = useForm({ ...product, stock })

  const save = (tab: string, defaultTab = "product") => {
    form.transform(({ id: _id, hasVariants, prices, stock, ...data }) => ({
      product: hasVariants ? data : { ...data, price_inputs: prices },
      ...(hasVariants || Object.keys(stock).length === 0 ? {} : { stock }),
    }))
    const query = tab === defaultTab ? "" : `?tab=${tab}`
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
    productHasErrors: errorKeys.some((key) => !isSalesError(key)),
    salesHaveErrors: errorKeys.some(isSalesError),
  }
}

export type ProductFormState = ReturnType<typeof useProductForm>

// Nazwa, status (Szkic/Aktywny), SKU, EAN (i katalog przy nowym produkcie).
export function ProductBasicsCard({ state, product, catalogs, statuses }: { state: ProductFormState } & Pick<ProductFormProps, "product" | "catalogs" | "statuses">) {
  const { form, errors } = state
  const error = (key: string) => errorText(errors, key)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dane podstawowe</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldError>{error("base")}</FieldError>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field data-invalid={!!error("name")}>
              <FieldLabel htmlFor="name">Nazwa</FieldLabel>
              <Input id="name" value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} aria-invalid={!!error("name")} autoFocus={!product.id} />
              <FieldError>{error("name")}</FieldError>
            </Field>
            <Field data-invalid={!!error("status")}>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <OptionSelect
                id="status"
                options={Object.entries(statuses).map(([value, label]) => ({ value, label }))}
                value={form.data.status}
                onChange={(value) => form.setData("status", value)}
              />
              <FieldError>{error("status")}</FieldError>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!error("sku")}>
              <FieldLabel htmlFor="sku">SKU</FieldLabel>
              <Input id="sku" value={form.data.sku} onChange={(e) => form.setData("sku", e.target.value)} aria-invalid={!!error("sku")} />
              {product.hasVariants && <FieldDescription>Opcjonalne - warianty mają własne SKU.</FieldDescription>}
              <FieldError>{error("sku")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ean">EAN</FieldLabel>
              <Input id="ean" value={form.data.ean} onChange={(e) => form.setData("ean", e.target.value)} />
            </Field>
          </div>
          {!product.id && catalogs.length > 1 && (
            <Field>
              <FieldLabel htmlFor="catalog">Katalog</FieldLabel>
              <OptionSelect
                id="catalog"
                options={catalogs.map((catalog) => ({ value: String(catalog.id), label: catalog.name }))}
                value={String(form.data.catalog_id)}
                onChange={(value) => form.setData("catalog_id", Number(value))}
              />
              <FieldDescription>Katalogu nie zmienisz po dodaniu produktu.</FieldDescription>
            </Field>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

const DESCRIPTIONS = [
  { key: "description", label: "Opis" },
  { key: "description_extra_1", label: "Dodatkowy 1" },
  { key: "description_extra_2", label: "Dodatkowy 2" },
  { key: "description_extra_3", label: "Dodatkowy 3" },
] as const

// Opis główny i trzy dodatkowe (np. skład, wymiary, pielęgnacja - do szablonów Allegro i sklepów), przełączane w karcie.
export function ProductDescriptionsCard({ state }: { state: ProductFormState }) {
  const { form } = state
  const [active, setActive] = useState<(typeof DESCRIPTIONS)[number]["key"]>("description")
  const current = DESCRIPTIONS.find((d) => d.key === active)!

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opisy</CardTitle>
        <CardDescription>Opis główny i opisy dodatkowe, np. skład, rozmiarówka albo pielęgnacja - do szablonów ofert i sklepów.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="bg-muted inline-flex w-fit max-w-full overflow-x-auto rounded-lg p-0.5" role="tablist" aria-label="Opisy">
          {DESCRIPTIONS.map((item) => {
            const filled = form.data[item.key].trim() !== ""
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active === item.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
                  active === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setActive(item.key)}
              >
                {item.label}
                {filled && <span className="bg-primary size-1.5 rounded-full" aria-label="uzupełniony" />}
              </button>
            )
          })}
        </div>
        <Textarea
          aria-label={current.label}
          className="min-h-48"
          value={form.data[active]}
          onChange={(e) => form.setData(active, e.target.value)}
        />
      </CardContent>
    </Card>
  )
}

// Parametry produktu: pary nazwa - wartość (np. Materiał - bawełna).
export function ProductParametersCard({ state }: { state: ProductFormState }) {
  const { form, errors } = state
  const rows = form.data.parameters
  const update = (index: number, field: keyof ProductParameter, value: string) =>
    form.setData("parameters", rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  const add = () => form.setData("parameters", [...rows, { name: "", value: "" }])
  const remove = (index: number) => form.setData("parameters", rows.filter((_, i) => i !== index))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parametry</CardTitle>
        <CardDescription>Cechy produktu, np. Materiał - bawełna, Kolor - czarny. Trafiają do ofert i filtrów w sklepach.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={add}>
            <PlusIcon />
            Dodaj parametr
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak parametrów.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => {
              const nameError = errorText(errors, `parameters.${index}.name`)
              const valueError = errorText(errors, `parameters.${index}.value`)
              return (
                <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Input
                      aria-label={`Nazwa parametru ${index + 1}`}
                      placeholder="Nazwa, np. Materiał"
                      value={row.name}
                      aria-invalid={!!nameError}
                      autoFocus={index === rows.length - 1 && row.name === "" && row.value === ""}
                      onChange={(e) => update(index, "name", e.target.value)}
                    />
                    <FieldError>{nameError}</FieldError>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Input
                      aria-label={`Wartość parametru ${index + 1}`}
                      placeholder="Wartość, np. bawełna"
                      value={row.value}
                      aria-invalid={!!valueError}
                      onChange={(e) => update(index, "value", e.target.value)}
                    />
                    <FieldError>{valueError}</FieldError>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Usuń parametr ${row.name || index + 1}`} onClick={() => remove(index)}>
                    <Trash2Icon />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const DIMENSION_FIELDS = [
  { key: "length_cm", label: "Długość", unit: "cm" },
  { key: "width_cm", label: "Szerokość", unit: "cm" },
  { key: "height_cm", label: "Wysokość", unit: "cm" },
  { key: "weight_kg", label: "Waga", unit: "kg" },
] as const

// Wymiary i waga produktu w opakowaniu - do wyliczania przesyłek.
export function ProductDimensionsCard({ state }: { state: ProductFormState }) {
  const { form, errors } = state

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wymiary i waga</CardTitle>
        <CardDescription>Produkt w opakowaniu - do wyboru gabarytu i kosztu przesyłki.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-4">
          {DIMENSION_FIELDS.map((field) => {
            const error = errorText(errors, field.key)
            return (
              <Field key={field.key} data-invalid={!!error}>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <div className="relative">
                  <Input
                    id={field.key}
                    inputMode="decimal"
                    placeholder="-"
                    className="pr-10"
                    value={form.data[field.key]}
                    onChange={(e) => form.setData(field.key, e.target.value)}
                    aria-invalid={!!error}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">{field.unit}</span>
                </div>
                <FieldError>{error}</FieldError>
              </Field>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
