import { OptionSelect } from "@/components/option-select"
import { PriceFields } from "@/components/inventory/price-fields"
import { errorText, type FormErrors, type PriceGroup, type PriceInputs } from "@/components/inventory/types"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

// Stawka VAT. Wariant (`inherited` = stawka produktu głównego) dziedziczy ją, gdy wartość to "": pole pokazuje wtedy
// stawkę produktu, a wybranie tej samej stawki co produkt wraca do dziedziczenia.
export type TaxRateControl = { value: string; options: string[]; onChange: (value: string) => void; inherited?: string }

export function TaxRateField({ taxRate, errors }: { taxRate: TaxRateControl; errors?: FormErrors }) {
  const error = errors && errorText(errors, "tax_rate")
  const { inherited } = taxRate
  const options = taxRate.options.map((rate) => ({ value: rate, label: `${rate}%` }))
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="tax_rate">Stawka VAT</FieldLabel>
      <OptionSelect
        id="tax_rate"
        options={options}
        value={taxRate.value || inherited || ""}
        onChange={(value) => taxRate.onChange(value === inherited ? "" : value)}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

// Ceny i VAT w jednym rzędzie: stawka VAT, a po niej cena brutto w każdej grupie cenowej katalogu.
// Bez nagłówka - etykiety pól (VAT, nazwy grup z walutą) mówią same za siebie.
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
      <CardContent>
        <PriceFields priceGroups={priceGroups} value={value} onChange={onChange} errors={errors} leading={<TaxRateField taxRate={taxRate} errors={errors} />} />
      </CardContent>
    </Card>
  )
}
