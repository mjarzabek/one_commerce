import { useForm } from "@inertiajs/react"
import { ArrowDownToLineIcon, CheckIcon, SlidersHorizontalIcon, type LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactElement } from "react"

import { OptionSelect } from "@/components/option-select"
import { errorText, type FormErrors, type StockWarehouse } from "@/components/inventory/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Mode = "receive" | "set"


const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: "receive", label: "Przyjęcie towaru", icon: ArrowDownToLineIcon },
  { value: "set", label: "Korekta stanu", icon: SlidersHorizontalIcon },
]

// Przyjęcie (dodaje sztuki) albo korekta po inwentaryzacji (ustawia stan) w wybranym magazynie.
export function AdjustStockDialog({
  productId,
  label,
  warehouses,
  initialWarehouseId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  productId: number
  label: string
  warehouses: StockWarehouse[]
  initialWarehouseId?: number
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setInnerOpen(next))
  const initial = { mode: "receive" as Mode, warehouse_id: String(initialWarehouseId ?? warehouses[0]?.id ?? ""), quantity: "", note: "" }
  const form = useForm(initial)
  const quantityError = errorText(form.errors as FormErrors, "quantity")
  const warehouse = warehouses.find((w) => String(w.id) === form.data.warehouse_id)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.post(`/inventory/products/${productId}/adjustments`, {
      preserveScroll: true,
      preserveState: "errors",
      onSuccess: () => setOpen(false),
    })
  }

  // Przy każdym otwarciu formularz startuje od wartości początkowych.
  useEffect(() => {
    if (!open) return
    form.setData(initial)
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const quantity = Number(form.data.quantity)
  const preview =
    !warehouse || form.data.quantity === "" || Number.isNaN(quantity)
      ? null
      : form.data.mode === "receive"
        ? warehouse.on_hand + quantity
        : quantity

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Zmień stan</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>

          <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => form.setData("mode", mode.value)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  form.data.mode === mode.value ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <mode.icon className="size-4" />
                {mode.label}
              </button>
            ))}
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="warehouse">Magazyn</FieldLabel>
              <OptionSelect
                id="warehouse"
                options={warehouses.map((w) => ({ value: String(w.id), label: `${w.name} (na stanie ${w.on_hand}, zarezerw. ${w.reserved})` }))}
                value={form.data.warehouse_id}
                onChange={(value) => form.setData("warehouse_id", value)}
              />
            </Field>
            <Field data-invalid={!!quantityError}>
              <FieldLabel htmlFor="quantity">{form.data.mode === "receive" ? "Liczba przyjętych sztuk" : "Stan po korekcie"}</FieldLabel>
              <Input
                id="quantity"
                type="number"
                min={form.data.mode === "receive" ? 1 : 0}
                step={1}
                value={form.data.quantity}
                onChange={(e) => form.setData("quantity", e.target.value)}
                aria-invalid={!!quantityError}
                autoFocus
              />
              {preview !== null && !quantityError && <FieldDescription>Na stanie po zmianie: {preview} szt.</FieldDescription>}
              <FieldError>{quantityError}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="note">Opis (opcjonalnie)</FieldLabel>
              <Input
                id="note"
                placeholder={form.data.mode === "receive" ? "np. dostawa FV 12/2026" : "np. inwentaryzacja"}
                value={form.data.note}
                onChange={(e) => form.setData("note", e.target.value)}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={form.processing}>
              <CheckIcon />
              {form.processing ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
