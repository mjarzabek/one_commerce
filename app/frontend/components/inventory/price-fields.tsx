import { DefaultStar } from "@/components/default-star"
import { errorText, type FormErrors, type PriceGroup, type PriceInputs } from "@/components/inventory/types"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// Pola cen brutto we wszystkich grupach cenowych. Puste pole = brak ceny w grupie.
export function PriceFields({
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
    <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
      {priceGroups.map((group) => {
        const key = `prices.${group.id}`
        return (
          <Field key={group.id} data-invalid={!!errorText(errors, key)}>
            <FieldLabel htmlFor={`price-${group.id}`} className="gap-1.5">
              {group.default && <DefaultStar />}
              {group.name}
            </FieldLabel>
            <div className="relative">
              <Input
                id={`price-${group.id}`}
                inputMode="decimal"
                placeholder="—"
                className="pr-12"
                value={value[String(group.id)] ?? ""}
                onChange={(e) => onChange({ ...value, [String(group.id)]: e.target.value })}
                aria-invalid={!!errorText(errors, key)}
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                {group.currency}
              </span>
            </div>
            <FieldError>{errorText(errors, key)}</FieldError>
          </Field>
        )
      })}
    </div>
  )
}
