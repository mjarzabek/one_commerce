import { useForm } from "@inertiajs/react"
import { PencilIcon, PlusIcon, Trash2Icon, Undo2Icon } from "lucide-react"
import { useState } from "react"

import { OptionCombobox } from "@/components/option-combobox"
import { OptionSelect } from "@/components/option-select"
import { errorText, type CatalogOption, type FormErrors, type PriceGroup, type PriceInputs, type ProductImage, type StockInputs } from "@/components/inventory/types"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ProductParameter = { name: string; value: string }

// Karta produktu i wariantu mają te same pola. U wariantu puste pole dziedziczy wartość produktu głównego:
// opis = null, VAT i wymiary = "". Parametry i zdjęcia wariantu to własne + odziedziczone.
export type ProductFormData = {
  id: number | null
  catalog_id: number
  name: string
  sku: string
  ean: string
  manufacturer: string
  // "" = bez kategorii (wariant: kategoria produktu głównego).
  category_id: string
  description: string | null
  description_extra_1: string | null
  description_extra_2: string | null
  description_extra_3: string | null
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
  categories: CategoryOption[]
  priceGroups: PriceGroup[]
  // Grupy cenowe, z których korzysta każdy katalog: { catalog_id: [price_group_id, …] }.
  catalogPriceGroups: Record<string, number[]>
  // Statusy do wyboru w formularzu (Szkic, Aktywny).
  statuses: Record<string, string>
  taxRates: string[]
}

// Wartości produktu głównego, które dziedziczy wariant (podglądy i podpowiedzi na karcie wariantu).
export type InheritedFields = {
  tax_rate: string
  manufacturer: string
  category_id: string
  parameters: ProductParameter[]
  description: string
  description_extra_1: string
  description_extra_2: string
  description_extra_3: string
  length_cm: string
  width_cm: string
  height_cm: string
  weight_kg: string
  images: ProductImage[]
}

// Kategoria do wyboru: ogólna (catalog_id null) albo katalogu; `path` - „Odzież › Sukienki”.
export type CategoryOption = { id: number; path: string; catalog_id: number | null }

const categoryInCatalog = (category: CategoryOption, catalogId: number) => category.catalog_id === null || category.catalog_id === catalogId

// Gdzie zapisuje formularz: produkt (domyślnie) albo wariant produktu `parentId`.
type FormTarget = { kind: "product" } | { kind: "variant"; parentId: number }

// Grupy cenowe katalogu wybranego w formularzu.
export const priceGroupsForCatalog = ({ priceGroups, catalogPriceGroups }: Pick<ProductFormProps, "priceGroups" | "catalogPriceGroups">, catalogId: number) =>
  priceGroups.filter((group) => (catalogPriceGroups[String(catalogId)] ?? []).includes(group.id))

// Pola zakładki „Sprzedaż” (przy produkcie z wariantami VAT jest w zakładce „Warianty”) - po nich wiadomo, na której
// zakładce są błędy.
const SALES_FIELDS = ["tax_rate"]
const isSalesError = (key: string) => key.startsWith("prices.") || key.startsWith("stock.") || SALES_FIELDS.includes(key)

// Formularz karty produktu albo wariantu: dane, treści, ceny i stan (produkt prosty, wariant) - jeden zapis;
// wraca na bieżącą zakładkę.
export function useProductForm(product: ProductFormData, stock: StockInputs = {}, target: FormTarget = { kind: "product" }) {
  const form = useForm({ ...product, stock })

  const save = (tab: string, defaultTab = "product") => {
    form.transform(({ id: _id, hasVariants, prices, stock, catalog_id, ...data }) => ({
      [target.kind]: { ...data, ...(target.kind === "product" && { catalog_id }), ...(!hasVariants && { price_inputs: prices }) },
      ...(hasVariants || Object.keys(stock).length === 0 ? {} : { stock }),
    }))
    const query = tab === defaultTab ? "" : `?tab=${tab}`
    const options = { preserveScroll: true, preserveState: "errors" as const }
    if (target.kind === "variant") {
      if (product.id) form.patch(`/inventory/variants/${product.id}${query}`, options)
      else form.post(`/inventory/products/${target.parentId}/variants${query}`, options)
    } else if (product.id) form.patch(`/inventory/products/${product.id}${query}`, options)
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

// Nazwa, status (Szkic/Aktywny), SKU, EAN, producent, kategoria (i katalog przy nowym produkcie). Wariant (`parent`)
// ma nazwę wariantu, np. „M” albo „czarny” - pełna nazwa to „<produkt> - <wariant>”; producenta i kategorię
// dziedziczy z produktu głównego (`inherited`), dopóki nie ustawi własnych.
export function ProductBasicsCard({
  state,
  product,
  catalogs = [],
  categories,
  statuses,
  parent,
  inherited,
}: {
  state: ProductFormState
  catalogs?: CatalogOption[]
  parent?: { name: string; sku: string | null }
  inherited?: InheritedFields
} & Pick<ProductFormProps, "product" | "statuses" | "categories">) {
  const { form, errors } = state
  const error = (key: string) => errorText(errors, key)
  const inheritedCategory = inherited?.category_id || ""
  // Wariant z kategorią produktu nie ma pozycji „Brak” - pusta wartość oznacza tam kategorię produktu.
  const categoryOptions = [
    ...(inheritedCategory ? [] : [{ value: "", label: "Brak kategorii" }]),
    ...categories.filter((c) => categoryInCatalog(c, form.data.catalog_id)).map((c) => ({ value: String(c.id), label: c.path })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{parent ? "Dane wariantu" : "Dane podstawowe"}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldError>{error("base")}</FieldError>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field data-invalid={!!error("name")}>
              <FieldLabel htmlFor="name">{parent ? "Wariant" : "Nazwa"}</FieldLabel>
              <Input
                id="name"
                placeholder={parent ? "np. M, czarny" : undefined}
                value={form.data.name}
                onChange={(e) => form.setData("name", e.target.value)}
                aria-invalid={!!error("name")}
                autoFocus={!product.id}
              />
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
              <Input
                id="sku"
                placeholder={parent?.sku ? `np. ${parent.sku}-M` : undefined}
                value={form.data.sku}
                onChange={(e) => form.setData("sku", e.target.value)}
                aria-invalid={!!error("sku")}
              />
              {product.hasVariants && <FieldDescription>Opcjonalne - warianty mają własne SKU.</FieldDescription>}
              <FieldError>{error("sku")}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="ean">EAN</FieldLabel>
              <Input id="ean" value={form.data.ean} onChange={(e) => form.setData("ean", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!error("manufacturer")}>
              <FieldLabel htmlFor="manufacturer">Producent</FieldLabel>
              <Input
                id="manufacturer"
                placeholder={inherited?.manufacturer || undefined}
                value={form.data.manufacturer}
                onChange={(e) => form.setData("manufacturer", e.target.value)}
                aria-invalid={!!error("manufacturer")}
              />
              <FieldError>{error("manufacturer")}</FieldError>
            </Field>
            <Field data-invalid={!!error("category_id")}>
              <FieldLabel htmlFor="category">Kategoria</FieldLabel>
              <OptionCombobox
                id="category"
                label="Kategoria"
                placeholder="Brak kategorii"
                searchPlaceholder="Szukaj kategorii…"
                emptyText="Brak pasujących kategorii"
                options={categoryOptions}
                value={form.data.category_id || inheritedCategory}
                onChange={(value) => form.setData("category_id", value === inheritedCategory ? "" : value)}
                invalid={!!error("category_id")}
              />
              <FieldError>{error("category_id")}</FieldError>
            </Field>
          </div>
          {!product.id && !parent && catalogs.length > 1 && (
            <Field>
              <FieldLabel htmlFor="catalog">Katalog</FieldLabel>
              <OptionSelect
                id="catalog"
                options={catalogs.map((catalog) => ({ value: String(catalog.id), label: catalog.name }))}
                value={String(form.data.catalog_id)}
                onChange={(value) => {
                  const catalogId = Number(value)
                  const category = categories.find((c) => String(c.id) === form.data.category_id)
                  form.setData((data) => ({
                    ...data,
                    catalog_id: catalogId,
                    category_id: category && !categoryInCatalog(category, catalogId) ? "" : data.category_id,
                  }))
                }}
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
// Wariant (`inherited`) pokazuje opis produktu głównego, dopóki nie ustawi własnego - każdy opis osobno.
export function ProductDescriptionsCard({ state, inherited }: { state: ProductFormState; inherited?: InheritedFields }) {
  const { form } = state
  const [active, setActive] = useState<(typeof DESCRIPTIONS)[number]["key"]>("description")
  const current = DESCRIPTIONS.find((d) => d.key === active)!
  const value = form.data[active]
  const isInherited = !!inherited && value === null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opisy</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="bg-muted inline-flex w-fit max-w-full overflow-x-auto rounded-lg p-0.5" role="tablist" aria-label="Opisy">
          {DESCRIPTIONS.map((item) => {
            const own = form.data[item.key]
            // Kropka: produkt - opis uzupełniony; wariant - własny opis wariantu.
            const marked = inherited ? own !== null : (own ?? "").trim() !== ""
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
                {marked && <span className="bg-primary size-1.5 rounded-full" aria-label={inherited ? "własny opis wariantu" : "uzupełniony"} />}
              </button>
            )
          })}
        </div>
        {isInherited ? (
          <Textarea
            aria-label={`${current.label} (z produktu głównego)`}
            className="bg-muted/50 text-muted-foreground min-h-48"
            readOnly
            value={inherited[active]}
            placeholder="Produkt główny nie ma tego opisu."
          />
        ) : (
          <Textarea aria-label={current.label} className="min-h-48" value={value ?? ""} onChange={(e) => form.setData(active, e.target.value)} />
        )}
        {inherited && (
          <div className="flex justify-end">
            {isInherited ? (
              <Button variant="outline" size="sm" onClick={() => form.setData(active, inherited[active])}>
                <PencilIcon />
                Ustaw własny opis
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => form.setData(active, null)}>
                <Undo2Icon />
                Przywróć opis produktu
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Parametry produktu: pary nazwa - wartość (np. Materiał - bawełna). Wariant (`inherited`) ma parametry produktu
// głównego i własne; własny parametr o tej samej nazwie nadpisuje wartość z produktu.
export function ProductParametersCard({ state, inherited }: { state: ProductFormState; inherited?: InheritedFields }) {
  const { form, errors } = state
  const rows = form.data.parameters
  const update = (index: number, field: keyof ProductParameter, value: string) =>
    form.setData("parameters", rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  const add = (row: ProductParameter = { name: "", value: "" }) => form.setData("parameters", [...rows, row])
  const remove = (index: number) => form.setData("parameters", rows.filter((_, i) => i !== index))
  const fromParent = (inherited?.parameters ?? []).filter((param) => !rows.some((row) => sameName(row.name, param.name)))
  const overrides = (row: ProductParameter) => !!inherited?.parameters.some((param) => row.name.trim() !== "" && sameName(row.name, param.name))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parametry</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => add()}>
            <PlusIcon />
            Dodaj parametr
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && fromParent.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak parametrów.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fromParent.map((param) => (
              <div key={`parent-${param.name}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
                <Input aria-label={`Nazwa parametru ${param.name} (z produktu głównego)`} value={param.name} readOnly className="bg-muted/50 text-muted-foreground" />
                <Input aria-label={`Wartość parametru ${param.name} (z produktu głównego)`} value={param.value} readOnly className="bg-muted/50 text-muted-foreground" />
                <Button variant="ghost" size="icon" aria-label={`Zmień parametr ${param.name} dla wariantu`} title="Zmień dla wariantu" onClick={() => add({ ...param })}>
                  <PencilIcon />
                </Button>
              </div>
            ))}
            {rows.map((row, index) => {
              const nameError = errorText(errors, `parameters.${index}.name`)
              const valueError = errorText(errors, `parameters.${index}.value`)
              const override = overrides(row)
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
                      autoFocus={index === rows.length - 1 && row.name !== "" && override}
                      onChange={(e) => update(index, "value", e.target.value)}
                    />
                    <FieldError>{valueError}</FieldError>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={override ? `Przywróć parametr ${row.name} z produktu` : `Usuń parametr ${row.name || index + 1}`}
                    title={override ? "Przywróć wartość z produktu" : undefined}
                    onClick={() => remove(index)}
                  >
                    {override ? <Undo2Icon /> : <Trash2Icon />}
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

// Wymiary i waga produktu w opakowaniu - do wyliczania przesyłek. Wariant: puste pole = wartość produktu głównego
// (w podpowiedzi pola).
export function ProductDimensionsCard({ state, inherited }: { state: ProductFormState; inherited?: InheritedFields }) {
  const { form, errors } = state

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wymiary i waga w opakowaniu</CardTitle>
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
                    placeholder={inherited?.[field.key] || "-"}
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
