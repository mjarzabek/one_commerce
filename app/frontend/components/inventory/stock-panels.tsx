import { useForm } from "@inertiajs/react"
import { CheckCheckIcon, LockIcon, UnlockIcon } from "lucide-react"
import { useState } from "react"

import { ConfirmAction } from "@/components/inventory/confirm-button"
import { MovementReason, StockChange } from "@/components/inventory/movement-reason"
import { errorText, type FormErrors, type ProductStock, type StockWarehouse } from "@/components/inventory/types"
import { RowActions } from "@/components/row-actions"
import { SaveBar } from "@/components/save-bar"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const formatDate = (iso: string) => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })

type Reservation = ProductStock["reservations"][number]

// Akcje wiersza rezerwacji (⋯): realizacja (wydanie z magazynu) albo zwolnienie.
function ReservationActions({ reservation }: { reservation: Reservation }) {
  const [dialog, setDialog] = useState<"fulfill" | "release" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <RowActions
        actions={[
          { label: "Zrealizuj", icon: CheckCheckIcon, onSelect: () => setDialog("fulfill") },
          { label: "Zwolnij", icon: UnlockIcon, destructive: true, onSelect: () => setDialog("release") },
        ]}
      />
      <ConfirmAction
        open={dialog === "fulfill"}
        onOpenChange={close}
        title={`Zrealizować rezerwację - ${reservation.holder}?`}
        description={`${reservation.quantity} szt. zejdzie teraz ze stanu magazynu „${reservation.warehouse}” (jak przy wysyłce). Przy wysyłce zamówienia te sztuki nie zejdą drugi raz.`}
        confirmLabel="Zrealizuj"
        confirmIcon={CheckCheckIcon}
        url={`/inventory/reservations/${reservation.id}/fulfill`}
      />
      <ConfirmAction
        open={dialog === "release"}
        onOpenChange={close}
        title={`Zwolnić rezerwację - ${reservation.holder}?`}
        description={`${reservation.quantity} szt. wróci do dostępnych w magazynie „${reservation.warehouse}”. Jeśli zamówienie zostanie potem wysłane, towar zejdzie ze stanu przy wysyłce.`}
        confirmLabel="Zwolnij"
        confirmIcon={UnlockIcon}
        destructive
        url={`/inventory/reservations/${reservation.id}/release`}
      />
    </>
  )
}

// Stan w magazynie ze ścisłą kontrolą - tylko do odczytu.
function LockedOnHand({ warehouse }: { warehouse: StockWarehouse }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground inline-flex items-center" aria-label="Ścisła kontrola magazynowa">
              <LockIcon className="size-3.5" />
            </span>
          }
        />
        <TooltipContent>Ścisła kontrola - stan zmienisz tylko dokumentem magazynowym</TooltipContent>
      </Tooltip>
      {warehouse.on_hand}
    </span>
  )
}

// Zakładka „Stan”: stan w magazynach katalogu jako zwykłe pola (poza magazynami ze ścisłą kontrolą) i aktywne rezerwacje.
export function StockPanel({ productId, stock }: { productId: number; stock: ProductStock }) {
  const editable = stock.warehouses.filter((w) => !w.strict_control)
  const form = useForm({ stock: Object.fromEntries(editable.map((w) => [String(w.id), String(w.on_hand)])) as Record<string, string> })
  const errors = form.errors as FormErrors

  // Stan „na żywo” - z pola, jeśli wpisano poprawną liczbę.
  const onHand = (warehouse: StockWarehouse) => {
    const value = form.data.stock[String(warehouse.id)]
    return value === undefined || value.trim() === "" || Number.isNaN(Number(value)) ? warehouse.on_hand : Number(value)
  }
  const total = stock.warehouses.reduce(
    (sum, w) => ({ on_hand: sum.on_hand + onHand(w), reserved: sum.reserved + w.reserved }),
    { on_hand: 0, reserved: 0 },
  )

  const save = () =>
    form.patch(`/inventory/products/${productId}/stock`, {
      preserveScroll: true,
      preserveState: "errors",
      onSuccess: () => form.setDefaults(),
    })
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    save()
  }

  return (
    <div className="flex flex-col">
      <Card className="gap-0 pb-0">
        <form onSubmit={submit}>
          <CardHeader className="pb-4">
            <CardTitle>Stan w magazynach</CardTitle>
            <CardDescription>
              Wpisz, ile sztuk jest na stanie, i zapisz - każda zmiana trafi do historii. Magazyny ze ścisłą kontrolą zmieniają tylko dokumenty
              magazynowe.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Magazyn</TableHead>
                <TableHead className="text-right">Na stanie</TableHead>
                <TableHead className="text-right">Zarezerwowane</TableHead>
                <TableHead className="pr-6 text-right">Dostępne</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.warehouses.map((warehouse) => {
                const key = String(warehouse.id)
                const error = errorText(errors, `stock.${key}`)
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell className="pl-6 font-medium">{warehouse.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {warehouse.strict_control ? (
                        <LockedOnHand warehouse={warehouse} />
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Na stanie - ${warehouse.name}`}
                            aria-invalid={!!error}
                            className="w-24 text-right tabular-nums"
                            value={form.data.stock[key]}
                            onChange={(e) => form.setData("stock", { ...form.data.stock, [key]: e.target.value })}
                          />
                          <FieldError className="max-w-56 text-right">{error}</FieldError>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{warehouse.reserved}</TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">{onHand(warehouse) - warehouse.reserved}</TableCell>
                  </TableRow>
                )
              })}
              {stock.warehouses.length > 1 && (
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell className="pl-6">Łącznie</TableCell>
                  <TableCell className="text-right tabular-nums">{total.on_hand}</TableCell>
                  <TableCell className="text-right tabular-nums">{total.reserved}</TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{total.on_hand - total.reserved}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </form>
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Aktywne rezerwacje</CardTitle>
          <CardDescription>
            Sztuki odłożone dla zamówień - zejdą ze stanu przy wysyłce. Możesz je zrealizować wcześniej (wydać z magazynu) albo zwolnić.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Dla</TableHead>
              <TableHead>Magazyn</TableHead>
              <TableHead>Od</TableHead>
              <TableHead className="text-right">Sztuk</TableHead>
              <TableHead className="pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                  Brak aktywnych rezerwacji.
                </TableCell>
              </TableRow>
            ) : (
              stock.reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell className="pl-6 font-medium">{reservation.holder}</TableCell>
                  <TableCell>{reservation.warehouse}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(reservation.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{reservation.quantity}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <ReservationActions reservation={reservation} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <SaveBar
        visible={form.isDirty}
        processing={form.processing}
        label="Zapisz stan"
        onSave={save}
        onDiscard={() => {
          form.reset()
          form.clearErrors()
        }}
      />
    </div>
  )
}

// Zakładka „Historia”: zmiany stanu produktu - z ilu na ile (w danym magazynie), z czego (zamówienie, dokument) i kto.
export function MovementsPanel({ stock }: { stock: ProductStock }) {
  return (
    <Card className="gap-0 py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Data</TableHead>
              <TableHead>Ruch</TableHead>
              <TableHead>Magazyn</TableHead>
              <TableHead>Stan</TableHead>
              <TableHead>Opis</TableHead>
              <TableHead className="pr-6">Kto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Brak zmian stanu - uzupełnij stan w zakładce „Stan”.
                </TableCell>
              </TableRow>
            ) : (
              stock.movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-muted-foreground pl-6">{formatDate(movement.created_at)}</TableCell>
                  <TableCell>
                    <MovementReason reason={movement.reason} />
                  </TableCell>
                  <TableCell>{movement.warehouse}</TableCell>
                  <TableCell>
                    <StockChange before={movement.before} after={movement.after} quantity={movement.quantity} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{movement.description ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground pr-6">{movement.user ?? "system"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {stock.movements.length >= 50 && <p className="text-muted-foreground border-t px-6 py-2 text-xs">Pokazano 50 ostatnich ruchów.</p>}
    </Card>
  )
}
