import { router, useForm } from "@inertiajs/react"
import { CopyIcon, FileTextIcon, ReceiptIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorText, type FormErrors } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import type { Address, CustomFieldDefinition, Customer } from "@/components/orders/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type AddressKind = "shipping" | "billing" | "pickup"

type FieldSpec = { key: string; label: string; type?: "text" | "email" | "tel"; mono?: boolean }

// Pola adresów - te same klucze co Orders::ADDRESS_FIELDS.
const ADDRESS_SPECS: Record<AddressKind, FieldSpec[]> = {
  shipping: [
    { key: "name", label: "Imię i nazwisko" },
    { key: "company", label: "Firma" },
    { key: "street", label: "Ulica i numer" },
    { key: "postal_code", label: "Kod pocztowy" },
    { key: "city", label: "Miasto" },
    { key: "country", label: "Kraj" },
    { key: "phone", label: "Telefon", type: "tel" },
  ],
  billing: [
    { key: "name", label: "Imię i nazwisko" },
    { key: "company", label: "Firma" },
    { key: "nip", label: "NIP", mono: true },
    { key: "street", label: "Ulica i numer" },
    { key: "postal_code", label: "Kod pocztowy" },
    { key: "city", label: "Miasto" },
    { key: "country", label: "Kraj" },
  ],
  pickup: [
    { key: "name", label: "Nazwa" },
    { key: "code", label: "ID punktu", mono: true },
    { key: "street", label: "Ulica i numer" },
    { key: "postal_code", label: "Kod pocztowy" },
    { key: "city", label: "Miasto" },
  ],
}

const ADDRESS_TITLES: Record<AddressKind, string> = { shipping: "Adres dostawy", billing: "Dane do faktury", pickup: "Punkt odbioru" }

const copy = (text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Skopiowano ${what}.`),
    () => toast.error("Nie udało się skopiować."),
  )

export type InfoRow = { label: string; value: ReactNode; mono?: boolean; field?: string }

// Etykieta i wartość w siatce karty; brak wartości - kreska. Z `onEdit` wiersze są klikalne: kliknięcie otwiera
// edycję sekcji z kursorem w polu `field` (kliknięcia w linki i przyciski w wartości - nie).
export function InfoRows({ rows, onEdit }: { rows: InfoRow[]; onEdit?: (field?: string) => void }) {
  const value = (row: InfoRow) => (
    <dd className={cn("min-w-0 break-words", row.mono && "font-mono text-[13px]", !row.value && "text-muted-foreground")}>{row.value || "—"}</dd>
  )

  return (
    <dl className={cn("grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 text-sm", onEdit ? "-mx-2 gap-y-0.5" : "gap-y-1.5")}>
      {rows.map((row) =>
        onEdit ? (
          <div
            key={row.label}
            role="button"
            tabIndex={0}
            title="Kliknij, aby edytować"
            className="hover:bg-muted/60 focus-visible:ring-ring/50 col-span-2 grid cursor-pointer grid-cols-subgrid rounded-md px-2 py-0.5 outline-none focus-visible:ring-3"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a, button")) return
              onEdit(row.field)
            }}
            onKeyDown={(event) => {
              if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                onEdit(row.field)
              }
            }}
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            {value(row)}
          </div>
        ) : (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            {value(row)}
          </div>
        ),
      )}
    </dl>
  )
}

// Sekcja boksu z informacjami o zamówieniu (sekcje oddzielone liniami w jednej karcie).
export function PanelSection({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-5 py-4">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{title}</h2>
        {action && <div className="-mr-1.5 flex gap-1">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  )
}

// Edycja w miejscu: te same wiersze etykieta → wartość co InfoRows, tylko z polami, i Zapisz / Anuluj pod spodem.
// Enter zapisuje, Esc anuluje.
export function InlineForm({
  onSubmit,
  onCancel,
  processing,
  children,
  extra,
}: {
  onSubmit: () => void
  onCancel: () => void
  processing: boolean
  children: ReactNode
  extra?: ReactNode
}) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      onKeyDown={(event) => {
        // Esc z rozwiniętej listy (portal poza formularzem) zamyka tylko listę.
        if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) {
          event.preventDefault()
          onCancel()
        }
      }}
    >
      <div className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] items-start gap-x-4 gap-y-2 text-sm">{children}</div>
      {extra}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="submit" disabled={processing}>
          {processing ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>
    </form>
  )
}

// Wiersz InlineForm: etykieta i pole (z błędem pod spodem).
export function InlineField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id} className="text-muted-foreground flex min-h-9 items-center">
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </>
  )
}

// Pola tekstowe wg specyfikacji (adres, dane klienta) w InlineForm.
function SpecFields({
  prefix,
  specs,
  values,
  setValue,
  errors,
  focus,
}: {
  prefix: string
  specs: FieldSpec[]
  values: Record<string, string>
  setValue: (key: string, value: string) => void
  errors: FormErrors
  focus?: string
}) {
  return specs.map((spec, index) => (
    <InlineField key={spec.key} id={`${prefix}-${spec.key}`} label={spec.label} error={errorText(errors, spec.key)}>
      <Input
        id={`${prefix}-${spec.key}`}
        type={spec.type ?? "text"}
        value={values[spec.key] ?? ""}
        onChange={(e) => setValue(spec.key, e.target.value)}
        aria-invalid={!!errorText(errors, spec.key)}
        className={cn(spec.mono && "font-mono")}
        autoFocus={focus ? spec.key === focus : index === 0}
      />
    </InlineField>
  ))
}

// Adres jako tekst do schowka (np. do formularza kuriera).
const addressText = (kind: AddressKind, address: Address) =>
  ADDRESS_SPECS[kind]
    .map((spec) => (spec.key === "nip" && address.nip ? `NIP ${address.nip}` : address[spec.key as keyof Address]))
    .filter(Boolean)
    .join("\n")

// Karta adresu (dostawa, faktura, punkt odbioru): wszystkie pola z etykietami, edycja w miejscu (kliknięcie w pole)
// i kopiowanie.
export function AddressCard({
  orderId,
  kind,
  address,
  wantsInvoice,
  description,
}: {
  orderId: number
  kind: AddressKind
  address: Address
  wantsInvoice?: boolean
  description?: ReactNode
}) {
  const [editing, setEditing] = useState<string | false>(false)
  const specs = ADDRESS_SPECS[kind]
  const initial = Object.fromEntries(specs.map((spec) => [spec.key, address[spec.key as keyof Address] ?? ""]))
  const form = useForm({ kind, address: initial, wants_invoice: !!wantsInvoice })
  const empty = specs.every((spec) => !address[spec.key as keyof Address])

  const edit = (field?: string) => {
    form.setData({ kind, address: initial, wants_invoice: !!wantsInvoice })
    form.clearErrors()
    setEditing(field ?? specs[0].key)
  }
  const submit = () => form.patch(`/orders/${orderId}/address`, { preserveScroll: true, preserveState: "errors", onSuccess: () => setEditing(false) })

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{ADDRESS_TITLES[kind]}</CardTitle>
        <CardAction className="flex gap-1">
          {!empty && !editing && (
            <IconButton
              label={`Kopiuj: ${ADDRESS_TITLES[kind].toLowerCase()}`}
              onClick={() => copy(addressText(kind, address), ADDRESS_TITLES[kind].toLowerCase())}
            >
              <CopyIcon />
            </IconButton>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {description}
        {editing ? (
          <InlineForm
            onSubmit={submit}
            onCancel={() => setEditing(false)}
            processing={form.processing}
            extra={
              kind === "billing" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.data.wants_invoice} onCheckedChange={(checked) => form.setData("wants_invoice", !!checked)} />
                  Klient chce fakturę
                </label>
              )
            }
          >
            <SpecFields
              prefix={`address-${kind}`}
              specs={specs}
              values={form.data.address}
              setValue={(key, value) => form.setData("address", { ...form.data.address, [key]: value })}
              errors={form.errors as FormErrors}
              focus={editing}
            />
          </InlineForm>
        ) : (
          <InfoRows
            onEdit={edit}
            rows={specs.map((spec) => ({ label: spec.label, value: address[spec.key as keyof Address], mono: spec.mono, field: spec.key }))}
          />
        )}
      </CardContent>
    </Card>
  )
}

const CUSTOMER_SPECS: FieldSpec[] = [
  { key: "name", label: "Imię i nazwisko" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefon", type: "tel" },
]

// Informacje o zamówieniu: kontakt z klientem (z linkami, kopiowaniem i edycją) i skąd przyszło zamówienie.
export function InfoSection({
  orderId,
  customer,
  source,
  externalId,
}: {
  orderId: number
  customer: Customer
  source: string
  externalId: string | null
}) {
  const [editing, setEditing] = useState<string | false>(false)
  const initial = { name: customer.name ?? "", email: customer.email ?? "", phone: customer.phone ?? "" }
  const form = useForm(initial)

  const edit = (field?: string) => {
    form.setData(initial)
    form.clearErrors()
    setEditing(field ?? "name")
  }

  const contact = (value: string | null, href: string, what: string) =>
    value && (
      <span className="flex min-w-0 items-center gap-1">
        <a href={href} className="truncate hover:underline">
          {value}
        </a>
        <Button variant="ghost" size="icon-xs" aria-label={`Kopiuj ${what}`} title={`Kopiuj ${what}`} onClick={() => copy(value, what)}>
          <CopyIcon />
        </Button>
      </span>
    )

  return (
    <PanelSection title="Informacje">
      {editing ? (
        <InlineForm
          onSubmit={() => form.patch(`/orders/${orderId}/customer`, { preserveScroll: true, preserveState: "errors", onSuccess: () => setEditing(false) })}
          onCancel={() => setEditing(false)}
          processing={form.processing}
        >
          <SpecFields
            prefix="customer"
            specs={CUSTOMER_SPECS}
            values={form.data}
            setValue={(key, value) => form.setData(key as keyof typeof initial, value)}
            errors={form.errors as FormErrors}
            focus={editing}
          />
        </InlineForm>
      ) : (
        <InfoRows
          onEdit={edit}
          rows={[
            { label: "Imię i nazwisko", value: customer.name, field: "name" },
            { label: "E-mail", value: contact(customer.email, `mailto:${customer.email}`, "e-mail"), field: "email" },
            { label: "Telefon", value: contact(customer.phone, `tel:${customer.phone?.replace(/\s/g, "")}`, "telefon"), field: "phone" },
          ]}
        />
      )}
      <InfoRows
        rows={[
          { label: "Źródło", value: source },
          { label: "Nr w sklepie", value: externalId },
        ]}
      />
    </PanelSection>
  )
}

type FieldValue = string | boolean

// Wartość pola dodatkowego do odczytu: Tak / Nie, data po polsku, reszta jak jest.
const fieldText = (field: CustomFieldDefinition, value: FieldValue | undefined) => {
  if (field.kind === "boolean") return value === true ? "Tak" : "Nie"
  if (!value) return null
  if (field.kind === "date") return new Date(`${value}T00:00:00`).toLocaleDateString("pl-PL")
  return String(value)
}

// Wartości pól dodatkowych zdefiniowanych w ustawieniach. Kliknięcie w pole otwiera edycję całej sekcji.
export function CustomFieldsSection({ orderId, fields, values }: { orderId: number; fields: CustomFieldDefinition[]; values: Record<string, FieldValue> }) {
  const [editing, setEditing] = useState<string | false>(false)
  const initial = Object.fromEntries(fields.map((field) => [String(field.id), values[String(field.id)] ?? (field.kind === "boolean" ? false : "")]))
  const form = useForm<{ values: Record<string, FieldValue> }>({ values: initial })
  const errors = form.errors as FormErrors
  const setValue = (id: number, value: FieldValue) => form.setData("values", { ...form.data.values, [String(id)]: value })

  if (fields.length === 0) {
    return (
      <PanelSection title="Pola dodatkowe">
        <p className="text-muted-foreground text-sm">
          Brak pól.{" "}
          <button type="button" className="text-foreground underline-offset-4 hover:underline" onClick={() => router.visit("/orders/settings/fields")}>
            Dodaj w ustawieniach
          </button>
        </p>
      </PanelSection>
    )
  }

  const edit = (field?: string) => {
    form.setData({ values: initial })
    form.clearErrors()
    setEditing(field ?? String(fields[0].id))
  }

  return (
    <PanelSection title="Pola dodatkowe">
      {editing ? (
        <InlineForm
          onSubmit={() => form.patch(`/orders/${orderId}/fields`, { preserveScroll: true, preserveState: "errors", onSuccess: () => setEditing(false) })}
          onCancel={() => setEditing(false)}
          processing={form.processing}
        >
          {fields.map((field) => {
            const id = `custom-field-${field.id}`
            const value = form.data.values[String(field.id)]
            const error = errorText(errors, `values.${field.id}`)
            return (
              <InlineField key={field.id} id={id} label={field.name} error={error}>
                {field.kind === "boolean" ? (
                  <span className="flex min-h-9 items-center">
                    <Switch id={id} checked={value === true} onCheckedChange={(checked) => setValue(field.id, checked)} />
                  </span>
                ) : field.kind === "select" ? (
                  <OptionSelect
                    id={id}
                    label={field.name}
                    options={[{ value: "__none", label: "—" }, ...field.options.map((option) => ({ value: option, label: option }))]}
                    value={String(value) || "__none"}
                    onChange={(next) => setValue(field.id, next === "__none" ? "" : next)}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.kind === "date" ? "date" : "text"}
                    inputMode={field.kind === "number" ? "decimal" : undefined}
                    value={String(value ?? "")}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    aria-invalid={!!error}
                    autoFocus={editing === String(field.id)}
                  />
                )}
              </InlineField>
            )
          })}
        </InlineForm>
      ) : (
        <InfoRows
          onEdit={edit}
          rows={fields.map((field) => ({ label: field.name, value: fieldText(field, values[String(field.id)]), field: String(field.id) }))}
        />
      )}
    </PanelSection>
  )
}

// Faktury i paragony zamówienia. Wystawianie przyjdzie z integracją (Fakturownia / KSeF) - na razie przyciski nieaktywne.
export function DocumentsSection({ wantsInvoice }: { wantsInvoice: boolean }) {
  const soon = "Wystawianie dokumentów będzie dostępne po podłączeniu Fakturowni"
  return (
    <PanelSection
      title={
        <>
          Dokumenty
          {wantsInvoice && <Badge variant="secondary">Chce fakturę</Badge>}
        </>
      }
    >
      <div className="flex flex-wrap gap-2" title={soon}>
        <Button variant="outline" disabled>
          <ReceiptIcon />
          Paragon
        </Button>
        <Button variant="outline" disabled>
          <FileTextIcon />
          Faktura
        </Button>
      </div>
    </PanelSection>
  )
}
