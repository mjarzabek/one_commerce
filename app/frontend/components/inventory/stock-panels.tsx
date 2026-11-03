import { BoxesIcon, CheckCheckIcon, LockIcon, TagsIcon, UnlockIcon } from "lucide-react"
import { useState } from "react"

import { ConfirmAction } from "@/components/inventory/confirm-button"
import { MovementReason, StockChange, ValueChange } from "@/components/inventory/movement-reason"
import { errorText, formatDate, type FormErrors, type ProductActivity, type ProductStock, type StockInputs, type StockWarehouse } from "@/components/inventory/types"
import { RowActions } from "@/components/row-actions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Reservation = ProductActivity["reservations"][number]

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

// Karta „Stan w magazynach” na zakładce Sprzedaż: pola „Na stanie” są częścią formularza karty (jeden zapis z cenami).
export function StockFields({
  stock,
  value,
  onChange,
  errors,
}: {
  stock: ProductStock
  value: StockInputs
  onChange: (value: StockInputs) => void
  errors: FormErrors
}) {
  // Stan „na żywo” - z pola, jeśli wpisano poprawną liczbę.
  const onHand = (warehouse: StockWarehouse) => {
    const input = value[String(warehouse.id)]
    return input === undefined || input.trim() === "" || Number.isNaN(Number(input)) ? warehouse.on_hand : Number(input)
  }
  const total = stock.warehouses.reduce(
    (sum, w) => ({ on_hand: sum.on_hand + onHand(w), reserved: sum.reserved + w.reserved }),
    { on_hand: 0, reserved: 0 },
  )

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Stan w magazynach</CardTitle>
        <CardDescription>Każda zmiana trafi do historii. Magazyny ze ścisłą kontrolą zmieniają tylko dokumenty magazynowe.</CardDescription>
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
                        value={value[key] ?? ""}
                        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
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
    </Card>
  )
}

// Zakładka „Rezerwacje”: sztuki odłożone dla zamówień (przy produkcie z wariantami - wszystkich wariantów).
export function ReservationsPanel({ reservations }: { reservations: Reservation[] }) {
  const withProduct = reservations.some((r) => r.product)

  return (
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
            {withProduct && <TableHead>Wariant</TableHead>}
            <TableHead>Magazyn</TableHead>
            <TableHead>Od</TableHead>
            <TableHead className="text-right">Sztuk</TableHead>
            <TableHead className="pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground h-16 text-center">
                Brak aktywnych rezerwacji.
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell className="pl-6 font-medium">{reservation.holder}</TableCell>
                {withProduct && <TableCell>{reservation.product}</TableCell>}
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
  )
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground h-24 text-center">
        {children}
      </TableCell>
    </TableRow>
  )
}

// Zmiany stanu - z ilu na ile (w danym magazynie), z czego (zamówienie, dokument) i kto.
function MovementsTable({ movements }: { movements: ProductActivity["movements"] }) {
  const withProduct = movements.some((m) => m.product)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Data</TableHead>
          {withProduct && <TableHead>Wariant</TableHead>}
          <TableHead>Ruch</TableHead>
          <TableHead>Magazyn</TableHead>
          <TableHead>Stan</TableHead>
          <TableHead>Opis</TableHead>
          <TableHead className="pr-6">Kto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.length === 0 ? (
          <EmptyRow colSpan={7}>Brak zmian stanu.</EmptyRow>
        ) : (
          movements.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell className="text-muted-foreground pl-6">{formatDate(movement.created_at)}</TableCell>
              {withProduct && <TableCell className="font-medium">{movement.product}</TableCell>}
              <TableCell>
                <MovementReason reason={movement.reason} />
              </TableCell>
              <TableCell>{movement.warehouse}</TableCell>
              <TableCell>
                <StockChange before={movement.before} after={movement.after} />
              </TableCell>
              <TableCell className="text-muted-foreground">{movement.description ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground pr-6">{movement.user ?? "system"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

// Zmiany cen - w której grupie, z ilu na ile i kto.
function PriceChangesTable({ changes }: { changes: ProductActivity["priceChanges"] }) {
  const withProduct = changes.some((c) => c.product)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Data</TableHead>
          {withProduct && <TableHead>Wariant</TableHead>}
          <TableHead>Grupa cenowa</TableHead>
          <TableHead>Cena</TableHead>
          <TableHead className="pr-6">Kto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {changes.length === 0 ? (
          <EmptyRow colSpan={5}>Brak zmian cen.</EmptyRow>
        ) : (
          changes.map((change) => (
            <TableRow key={change.id}>
              <TableCell className="text-muted-foreground pl-6">{formatDate(change.created_at)}</TableCell>
              {withProduct && <TableCell className="font-medium">{change.product}</TableCell>}
              <TableCell>{change.priceGroup}</TableCell>
              <TableCell>
                <ValueChange direction={change.direction} before={change.before} after={change.after} />
              </TableCell>
              <TableCell className="text-muted-foreground pr-6">{change.user ?? "system"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

const HISTORY_VIEWS = [
  { value: "stock", label: "Stany", icon: BoxesIcon },
  { value: "prices", label: "Ceny", icon: TagsIcon },
] as const

// Zakładka „Historia”: przełącznik Stany | Ceny (ostatnie wpisy).
export function HistoryPanel({ activity }: { activity: ProductActivity }) {
  const [view, setView] = useState<(typeof HISTORY_VIEWS)[number]["value"]>("stock")
  const count = view === "stock" ? activity.movements.length : activity.priceChanges.length

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Historia</CardTitle>
        <CardDescription>{view === "stock" ? "Zmiany stanu w magazynach." : "Zmiany cen w grupach cenowych."}</CardDescription>
        <CardAction>
          <div className="bg-muted inline-flex rounded-lg p-0.5" role="group" aria-label="Rodzaj historii">
            {HISTORY_VIEWS.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant="ghost"
                aria-pressed={view === item.value}
                className={cn("h-7", view === item.value && "bg-background hover:bg-background shadow-sm")}
                onClick={() => setView(item.value)}
              >
                <item.icon />
                {item.label}
              </Button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <div className="overflow-x-auto">
        {view === "stock" ? <MovementsTable movements={activity.movements} /> : <PriceChangesTable changes={activity.priceChanges} />}
      </div>
      {count >= activity.limit && <p className="text-muted-foreground border-t px-6 py-2 text-xs">Pokazano {activity.limit} ostatnich zmian.</p>}
    </Card>
  )
}
