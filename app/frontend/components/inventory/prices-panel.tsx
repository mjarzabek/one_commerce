import { PriceFields } from "@/components/inventory/price-fields"
import type { FormErrors, PriceGroup, PriceInputs } from "@/components/inventory/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Zakładka „Ceny”: cena brutto w każdej grupie cenowej.
export function PricesPanel({
  priceGroups,
  value,
  onChange,
  errors,
}: {
  priceGroups: PriceGroup[]
  value: PriceInputs
  onChange: (value: PriceInputs) => void
  errors: FormErrors
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ceny brutto</CardTitle>
        <CardDescription>Grupy cenowe katalogu produktu. Puste pole = produkt nie jest sprzedawany w tej grupie. Grupy katalogu wybierasz w Magazyn › Katalogi.</CardDescription>
      </CardHeader>
      <CardContent>
        <PriceFields priceGroups={priceGroups} value={value} onChange={onChange} errors={errors} />
      </CardContent>
    </Card>
  )
}
