import { router, useForm } from "@inertiajs/react"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"

import { errorText, formatDate, type FormErrors } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import { InfoRows, InlineField, InlineForm, PanelSection } from "@/components/orders/order-blocks"
import { PaidAmountBadge } from "@/components/orders/payment-badge"
import { OrderStatusBadge } from "@/components/orders/status-badge"
import { StatusMenuItems } from "@/components/orders/status-menu"
import { PAYMENT_METHODS, type OrderStatus, type Payment, type StatusTree } from "@/components/orders/types"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { plural } from "@/lib/plural"
import { cn } from "@/lib/utils"

// Sekcje paska nad produktami: status, płatność, dostawa i wartość.
// Ten sam układ co reszta panelu: tytuł i wiersze etykieta → wartość; kliknięcie w wiersz otwiera edycję sekcji.

// Jak długo zamówienie jest w statusie: „przed chwilą”, „od 5 min”, „od 3 godz.”, „od 2 dni”.
const statusAge = (iso: string) => {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "przed chwilą"
  if (minutes < 60) return `od ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `od ${hours} godz.`
  const days = Math.floor(hours / 24)
  return `od ${days} ${plural(days, ["dnia", "dni", "dni"])}`
}

export type StockState = { state: "deducted" | "returned" | "reserved" | "cancelled" | "none"; label: string }

const STOCK_TONES: Record<StockState["state"], string> = {
  reserved: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  deducted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  returned: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
  none: "bg-muted text-muted-foreground",
}

// Status z historią w czasie (złożone, w statusie od) i stanem towaru w magazynie realizacji.
export function StatusSection({
  orderId,
  status,
  since,
  placedAt,
  stock,
  warehouse,
  statusTree,
}: {
  orderId: number
  status: OrderStatus
  since: string
  placedAt: string
  stock: StockState | null
  warehouse: string | null
  statusTree: StatusTree
}) {
  const changeStatus = (next: OrderStatus) => router.patch(`/orders/${orderId}/status`, { status_id: next.id }, { preserveScroll: true })

  return (
    <PanelSection title="Status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" aria-label={`Status: ${status.name}. Zmień status`}>
                <OrderStatusBadge name={status.name} color={status.color} className="font-medium" />
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-52">
            <StatusMenuItems tree={statusTree} current={status.id} onSelect={changeStatus} />
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-muted-foreground text-sm">{statusAge(since)}</span>
      </div>
      <InfoRows
        rows={[
          ...(stock
            ? [
                {
                  label: "Towar",
                  value: (
                    <span className="-my-0.5 flex flex-wrap items-center gap-x-2">
                      <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-medium", STOCK_TONES[stock.state])}>
                        {stock.label}
                      </span>
                      {warehouse && <span className="text-muted-foreground truncate">{warehouse}</span>}
                    </span>
                  ),
                },
              ]
            : []),
          { label: "Złożone", value: <span className="tabular-nums">{formatDate(placedAt)}</span> },
          { label: "W statusie od", value: <span className="tabular-nums">{formatDate(since)}</span> },
        ]}
      />
    </PanelSection>
  )
}

// Wartość zamówienia z rozbiciem na produkty i dostawę.
export function ValueSection({ subtotal, shipping, total, quantity }: { subtotal: string; shipping: string; total: string; quantity: number }) {
  return (
    <PanelSection title="Wartość">
      <InfoRows
        rows={[
          { label: `Produkty (${quantity} szt.)`, value: <span className="tabular-nums">{subtotal}</span> },
          { label: "Dostawa", value: <span className="tabular-nums">{shipping}</span> },
          { label: "Razem", value: <span className="font-semibold tabular-nums">{total}</span> },
        ]}
      />
    </PanelSection>
  )
}

const NO_METHOD = "none"
const METHOD_OPTIONS = [{ value: NO_METHOD, label: "Nie podano" }, ...PAYMENT_METHODS]

// Płatność: ile wpłacono z wartości zamówienia, sposób płatności, pobranie. Edycja w miejscu.
export function PaymentSection({ orderId, payment }: { orderId: number; payment: Payment }) {
  const [editing, setEditing] = useState<string | false>(false)
  const initial = { paid: payment.paidInput, payment_method: payment.method ?? NO_METHOD }
  const form = useForm(initial)
  const errors = form.errors as FormErrors

  const edit = (field?: string) => {
    form.setData(initial)
    form.clearErrors()
    setEditing(field ?? "first")
  }
  const submit = () => {
    form.transform((data) => ({ ...data, payment_method: data.payment_method === NO_METHOD ? "" : data.payment_method }))
    form.patch(`/orders/${orderId}/payment`, { preserveScroll: true, preserveState: "errors", onSuccess: () => setEditing(false) })
  }

  const overpaid =
    payment.status === "overpaid"
      ? [{ label: "Nadpłata", field: "paid", value: <span className="text-blue-600 tabular-nums dark:text-blue-400">{payment.overpaid}</span> }]
      : []

  return (
    <PanelSection title="Płatność">
      {editing ? (
        <InlineForm onSubmit={submit} onCancel={() => setEditing(false)} processing={form.processing}>
          <InlineField id="order-paid" label="Zapłacono" error={errorText(errors, "paid")}>
            <div className="flex gap-2">
              <Input
                id="order-paid"
                inputMode="decimal"
                value={form.data.paid}
                onChange={(e) => form.setData("paid", e.target.value)}
                aria-invalid={!!errorText(errors, "paid")}
                className="tabular-nums"
                autoFocus={editing !== "payment_method"}
              />
              <Button type="button" variant="outline" onClick={() => form.setData("paid", payment.totalInput)} title={`Całość: ${payment.total}`}>
                Całość
              </Button>
            </div>
          </InlineField>
          <InlineField id="order-payment-method" label="Sposób płatności" error={errorText(errors, "payment_method")}>
            <OptionSelect
              id="order-payment-method"
              options={METHOD_OPTIONS}
              value={form.data.payment_method}
              onChange={(value) => form.setData("payment_method", value)}
            />
          </InlineField>
        </InlineForm>
      ) : (
        <InfoRows
          onEdit={edit}
          rows={[
            {
              label: "Zapłacono",
              field: "paid",
              value: (
                <span className="-my-1 flex flex-wrap items-center gap-x-2">
                  <PaidAmountBadge payment={payment} />
                  <span className="text-muted-foreground tabular-nums">z {payment.total}</span>
                </span>
              ),
            },
            ...overpaid,
            { label: "Sposób płatności", value: payment.methodLabel, field: "payment_method" },
            { label: "Pobranie", value: payment.method === "cod" ? "Tak" : "Nie", field: "payment_method" },
          ]}
        />
      )}
    </PanelSection>
  )
}

// Dostawa: sposób i koszt (zmiana kosztu przelicza wartość zamówienia). Sposób - z podpowiedziami z innych zamówień.
export function ShippingSection({
  orderId,
  method,
  price,
  priceInput,
  suggestions,
}: {
  orderId: number
  method: string | null
  price: string
  priceInput: string
  suggestions: string[]
}) {
  const [editing, setEditing] = useState<string | false>(false)
  const initial = { method: method ?? "", price: priceInput }
  const form = useForm(initial)
  const errors = form.errors as FormErrors

  const edit = (field?: string) => {
    form.setData(initial)
    form.clearErrors()
    setEditing(field ?? "first")
  }
  const submit = () => form.patch(`/orders/${orderId}/shipping`, { preserveScroll: true, preserveState: "errors", onSuccess: () => setEditing(false) })

  return (
    <PanelSection title="Dostawa">
      {editing ? (
        <InlineForm onSubmit={submit} onCancel={() => setEditing(false)} processing={form.processing}>
          <InlineField id="order-shipping-method" label="Sposób dostawy">
            <Input
              id="order-shipping-method"
              list="order-shipping-methods"
              value={form.data.method}
              onChange={(e) => form.setData("method", e.target.value)}
              autoFocus={editing !== "price"}
            />
            <datalist id="order-shipping-methods">
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </InlineField>
          <InlineField id="order-shipping-price" label="Koszt dostawy" error={errorText(errors, "price")}>
            <Input
              id="order-shipping-price"
              inputMode="decimal"
              value={form.data.price}
              onChange={(e) => form.setData("price", e.target.value)}
              aria-invalid={!!errorText(errors, "price")}
              className="tabular-nums"
              autoFocus={editing === "price"}
            />
          </InlineField>
        </InlineForm>
      ) : (
        <InfoRows
          onEdit={edit}
          rows={[
            { label: "Sposób dostawy", value: method, field: "method" },
            { label: "Koszt dostawy", value: <span className="tabular-nums">{price}</span>, field: "price" },
          ]}
        />
      )}
    </PanelSection>
  )
}
