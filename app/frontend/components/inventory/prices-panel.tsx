import { OptionSelect } from "@/components/option-select"
import { PriceFields } from "@/components/inventory/price-fields"
import { errorText, type FormErrors, type PriceGroup, type PriceInputs } from "@/components/inventory/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

// Stawka VAT: wybór (produkt) albo tylko odczyt (wariant dziedziczy stawkę produktu głównego).
export type TaxRateControl = { value: string; options: string[]; onChange: (value: string) => void } | { value: string; inherited: true }

export function TaxRateField({ taxRate, errors }: { taxRate: TaxRateControl; errors?: FormErrors }) {
  const error = errors && errorText(errors, "tax_rate")
  return (
    <Field data-invalid={!!error} className="sm:max-w-44">
      <FieldLabel htmlFor="tax_rate">Stawka VAT</FieldLabel>
      {"inherited" in taxRate ? (
        <>
          <p className="text-sm font-medium">{taxRate.value}%</p>
          <FieldDescription>Jak produkt główny.</FieldDescription>
        </>
      ) : (
        <OptionSelect
          id="tax_rate"
          options={taxRate.options.map((rate) => ({ value: rate, label: `${rate}%` }))}
          value={taxRate.value}
          onChange={taxRate.onChange}
        />
      )}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

// Karta „Ceny i VAT”: stawka VAT i cena brutto w każdej grupie cenowej.
export function PricesPanel({
  priceGroups,
  value,
  onChange,
  errors,
  taxRate,
}: {
  priceGroups: PriceGroup[]
  value: PriceInputs
  onChange: (value: PriceInputs) => void
  errors: FormErrors
  taxRate: TaxRateControl
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ceny i VAT</CardTitle>
        <CardDescription>
          Ceny brutto w grupach cenowych katalogu. Puste pole = produkt nie jest sprzedawany w tej grupie. Grupy katalogu wybierasz w Produkty › Ustawienia ›
          Katalogi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TaxRateField taxRate={taxRate} errors={errors} />
        <PriceFields priceGroups={priceGroups} value={value} onChange={onChange} errors={errors} />
      </CardContent>
    </Card>
  )
}
