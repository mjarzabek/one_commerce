import { ArrowDownUpIcon, CheckCheckIcon, UnlockIcon } from "lucide-react"
import { useState } from "react"

import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog"
import { ConfirmAction } from "@/components/inventory/confirm-button"
import { MovementReason, StockChange } from "@/components/inventory/movement-reason"
import type { ProductStock, StockWarehouse } from "@/components/inventory/types"
import { RowActions } from "@/components/row-actions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const formatDate = (iso: string) => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })

type Reservation = ProductStock["reservations"][number]

// Akcje wiersza magazynu (⋯): zmiana stanu w tym magazynie.
function WarehouseRowActions({
  productId,
  label,
  warehouse,
  warehouses,
}: {
  productId: number
  label: string
  warehouse: StockWarehouse
  warehouses: StockWarehouse[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <RowActions actions={[{ label: "Zmień stan", icon: ArrowDownUpIcon, onSelect: () => setOpen(true) }]} />
      <AdjustStockDialog
        open={open}
        onOpenChange={setOpen}
        productId={productId}
        label={`${label} · ${warehouse.name}`}
        warehouses={warehouses}
        initialWarehouseId={warehouse.id}
      />
    </>
  )
}

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
        title={`Zrealizować rezerwację – ${reservation.holder}?`}
        description={`${reservation.quantity} szt. zejdzie teraz ze stanu magazynu „${reservation.warehouse}” (jak przy wysyłce). Przy wysyłce zamówienia te sztuki nie zejdą drugi raz.`}
        confirmLabel="Zrealizuj"
        confirmIcon={CheckCheckIcon}
        url={`/inventory/reservations/${reservation.id}/fulfill`}
      />
      <ConfirmAction
        open={dialog === "release"}
        onOpenChange={close}
        title={`Zwolnić rezerwację – ${reservation.holder}?`}
        description={`${reservation.quantity} szt. wróci do dostępnych w magazynie „${reservation.warehouse}”. Jeśli zamówienie zostanie potem wysłane, towar zejdzie ze stanu przy wysyłce.`}
        confirmLabel="Zwolnij"
        confirmIcon={UnlockIcon}
        destructive
        url={`/inventory/reservations/${reservation.id}/release`}
      />
    </>
  )
}

// Zakładka „Stan”: stan w magazynach katalogu (ze zmianą stanu) i aktywne rezerwacje.
export function StockPanel({ productId, label, stock }: { productId: number; label: string; stock: ProductStock }) {
  const total = stock.warehouses.reduce(
    (sum, w) => ({ on_hand: sum.on_hand + w.on_hand, reserved: sum.reserved + w.reserved }),
    { on_hand: 0, reserved: 0 },
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Stan w magazynach</CardTitle>
          <CardDescription>Magazyny, z których korzysta katalog produktu.</CardDescription>
          <CardAction>
            <AdjustStockDialog productId={productId} label={label} warehouses={stock.warehouses} trigger={
                <Button size="sm">
                  <ArrowDownUpIcon />
                  Zmień stan
                </Button>
              }
            />
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Magazyn</TableHead>
              <TableHead className="text-right">Na stanie</TableHead>
              <TableHead className="text-right">Zarezerwowane</TableHead>
              <TableHead className="text-right">Dostępne</TableHead>
              <TableHead className="pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="pl-6 font-medium">{warehouse.name}</TableCell>
                <TableCell className="text-right tabular-nums">{warehouse.on_hand}</TableCell>
                <TableCell className="text-right tabular-nums">{warehouse.reserved}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{warehouse.on_hand - warehouse.reserved}</TableCell>
                <TableCell className="pr-6 text-right">
                  <WarehouseRowActions productId={productId} label={label} warehouse={warehouse} warehouses={stock.warehouses} />
                </TableCell>
              </TableRow>
            ))}
            {stock.warehouses.length > 1 && (
              <TableRow className="bg-muted/40 font-medium">
                <TableCell className="pl-6">Łącznie</TableCell>
                <TableCell className="text-right tabular-nums">{total.on_hand}</TableCell>
                <TableCell className="text-right tabular-nums">{total.reserved}</TableCell>
                <TableCell className="text-right tabular-nums">{total.on_hand - total.reserved}</TableCell>
                <TableCell className="pr-6" />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Aktywne rezerwacje</CardTitle>
          <CardDescription>
            Sztuki odłożone dla zamówień – zejdą ze stanu przy wysyłce. Możesz je zrealizować wcześniej (wydać z magazynu) albo zwolnić.
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
    </div>
  )
}

// Zakładka „Historia”: ruchy magazynowe produktu ze stanem przed i po zmianie (w danym magazynie).
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
                  Brak ruchów – przyjmij towar w zakładce „Stan”.
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
                  <TableCell className="text-muted-foreground">{movement.description ?? "—"}</TableCell>
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
