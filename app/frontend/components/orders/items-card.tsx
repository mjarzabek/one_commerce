import { Link, useForm } from "@inertiajs/react"
import { ImageIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { errorText, type FormErrors } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import { RowActions } from "@/components/row-actions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type OrderItem = {
  id: number
  name: string
  sku: string | null
  quantity: number
  tax_rate: number
  unit_price: string
  unitPriceInput: string
  total: string
  image: string | null
  href: string | null
  catalog: boolean
}

type ProductHit = { id: number; name: string; sku: string | null; tax_rate: number; price: string | null; priceInput: string | null; available: number }

const TAX_OPTIONS = ["23", "8", "5", "0"].map((value) => ({ value, label: `${value}%` }))
const LOCKED_HINT = "Towar zszedł już ze stanu - nie można zmienić ilości ani produktów"

// Pozycje zamówienia z dodawaniem (z katalogu albo spoza), edycją i usuwaniem. `stockLocked` - towar zszedł już
// ze stanu: produktów z katalogu nie można dodawać, usuwać ani zmieniać im ilości.
export function ItemsCard({ orderId, items, stockLocked }: { orderId: number; items: OrderItem[]; stockLocked: boolean }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OrderItem | null>(null)
  const [removing, setRemoving] = useState<OrderItem | null>(null)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Produkty</CardTitle>
        <CardAction>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            Dodaj produkt
          </Button>
        </CardAction>
      </CardHeader>

      {/* Wąska karta: cena × ilość w linii pod nazwą; szeroka - osobna kolumna. */}
      <ul className="@container divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 py-4 pr-4 pl-6">
            <ItemThumb item={item} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {item.href ? (
                <Link href={item.href} className="truncate font-medium hover:underline">
                  {item.name}
                </Link>
              ) : (
                <span className="truncate font-medium">{item.name}</span>
              )}
              <span className="text-muted-foreground truncate text-xs">
                {[item.sku, `VAT ${item.tax_rate}%`, !item.catalog && "spoza katalogu"].filter(Boolean).join(" · ")}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums @xl:hidden">
                {item.unit_price} × {item.quantity}
              </span>
            </div>
            <span className="text-muted-foreground hidden text-sm whitespace-nowrap tabular-nums @xl:inline">
              {item.unit_price} × {item.quantity}
            </span>
            <span className="text-right font-medium whitespace-nowrap tabular-nums @xl:w-28">{item.total}</span>
            <RowActions
              label={`Akcje: ${item.name}`}
              actions={[
                { label: "Edytuj", icon: PencilIcon, onSelect: () => setEditing(item) },
                {
                  label: "Usuń",
                  icon: Trash2Icon,
                  destructive: true,
                  disabled: items.length <= 1 || (stockLocked && item.catalog),
                  onSelect: () => setRemoving(item),
                },
              ]}
            />
          </li>
        ))}
      </ul>

      <AddItemDialog orderId={orderId} open={adding} onOpenChange={setAdding} stockLocked={stockLocked} />
      {editing && <EditItemDialog orderId={orderId} item={editing} stockLocked={stockLocked} onClose={() => setEditing(null)} />}
      <ConfirmDelete
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Usunąć pozycję?"
        description={removing ? `„${removing.name}” zniknie z zamówienia, a wartość zamówienia się przeliczy.` : ""}
        url={removing ? `/orders/${orderId}/items/${removing.id}` : ""}
      />
    </Card>
  )
}

function ItemThumb({ item }: { item: OrderItem }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {item.image && !failed ? (
        <img src={item.image} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageIcon className="size-4" aria-hidden />
      )}
    </span>
  )
}

function ItemDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  processing,
  disabled,
  baseError,
  submitLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSubmit: () => void
  processing: boolean
  disabled?: boolean
  baseError?: string
  submitLabel: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FieldGroup className="grid grid-cols-2 gap-4">{children}</FieldGroup>
          {baseError && <p className="text-destructive text-sm">{baseError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={processing || disabled}>
              {processing ? "Zapisywanie…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type ItemForm = { product_id: string; name: string; sku: string; quantity: string; unit_price: string; tax_rate: string }

// Pola wspólne dla dodawania i edycji: ilość i cena (+ nazwa, SKU i VAT dla pozycji spoza katalogu).
function ItemFields({
  data,
  setData,
  errors,
  custom,
  quantityLocked,
  pricePlaceholder,
}: {
  data: ItemForm
  setData: (key: keyof ItemForm, value: string) => void
  errors: FormErrors
  custom: boolean
  quantityLocked?: boolean
  pricePlaceholder?: string
}) {
  const field = (key: keyof ItemForm, label: string, props: React.ComponentProps<typeof Input> = {}, className = "col-span-1") => (
    <Field data-invalid={!!errorText(errors, key)} className={className}>
      <FieldLabel htmlFor={`item-${key}`}>{label}</FieldLabel>
      <Input
        id={`item-${key}`}
        value={data[key]}
        onChange={(e) => setData(key, e.target.value)}
        aria-invalid={!!errorText(errors, key)}
        {...props}
      />
      <FieldError>{errorText(errors, key)}</FieldError>
    </Field>
  )

  return (
    <>
      {custom && field("name", "Nazwa", { autoFocus: true }, "col-span-2")}
      {custom && field("sku", "SKU")}
      {custom && (
        <Field className="col-span-1">
          <FieldLabel htmlFor="item-tax_rate">VAT</FieldLabel>
          <OptionSelect id="item-tax_rate" options={TAX_OPTIONS} value={data.tax_rate} onChange={(value) => setData("tax_rate", value)} />
        </Field>
      )}
      {field("quantity", "Ilość", {
        type: "number",
        min: 1,
        step: 1,
        className: "tabular-nums",
        disabled: quantityLocked,
        title: quantityLocked ? LOCKED_HINT : undefined,
      })}
      {field("unit_price", "Cena za sztukę", { inputMode: "decimal", className: "tabular-nums", placeholder: pricePlaceholder })}
    </>
  )
}

const EMPTY_FORM: ItemForm = { product_id: "", name: "", sku: "", quantity: "1", unit_price: "", tax_rate: "23" }

// Dodawanie: produkt z katalogu (wyszukiwarka z ceną i stanem w magazynie zamówienia) albo pozycja spoza katalogu.
function AddItemDialog({
  orderId,
  open,
  onOpenChange,
  stockLocked,
}: {
  orderId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  stockLocked: boolean
}) {
  const [custom, setCustom] = useState(stockLocked)
  const [product, setProduct] = useState<ProductHit | null>(null)
  const form = useForm<ItemForm>(EMPTY_FORM)
  const errors = form.errors as FormErrors

  useEffect(() => {
    if (!open) return
    form.setData(EMPTY_FORM)
    form.clearErrors()
    setProduct(null)
    setCustom(stockLocked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (hit: ProductHit) => {
    setProduct(hit)
    form.setData({ ...form.data, product_id: String(hit.id), unit_price: hit.priceInput ?? "" })
  }

  const submit = () => {
    form.transform((data) =>
      custom
        ? { name: data.name, sku: data.sku, quantity: data.quantity, unit_price: data.unit_price, tax_rate: data.tax_rate }
        : { product_id: data.product_id, quantity: data.quantity, unit_price: data.unit_price },
    )
    form.post(`/orders/${orderId}/items`, { preserveScroll: true, preserveState: "errors", onSuccess: () => onOpenChange(false) })
  }

  return (
    <ItemDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dodaj produkt"
      onSubmit={submit}
      processing={form.processing}
      disabled={!custom && !product}
      baseError={errorText(errors, "base") || errorText(errors, "product_id")}
      submitLabel="Dodaj"
    >
      <div className="bg-muted col-span-2 grid grid-cols-2 gap-1 rounded-lg p-1">
        {[
          { value: false, label: "Z katalogu" },
          { value: true, label: "Spoza katalogu" },
        ].map((mode) => (
          <Button
            key={mode.label}
            type="button"
            size="sm"
            variant={custom === mode.value ? "outline" : "ghost"}
            disabled={!mode.value && stockLocked}
            title={!mode.value && stockLocked ? LOCKED_HINT : undefined}
            onClick={() => setCustom(mode.value)}
          >
            {mode.label}
          </Button>
        ))}
      </div>

      {!custom && (
        <div className="col-span-2">
          {product ? (
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{product.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {[product.sku, `dostępne: ${product.available} szt.`].filter(Boolean).join(" · ")}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setProduct(null)}>
                Zmień
              </Button>
            </div>
          ) : (
            <ProductSearch orderId={orderId} onChoose={choose} />
          )}
        </div>
      )}

      {(custom || product) && (
        <ItemFields
          data={form.data}
          setData={(key, value) => form.setData(key, value)}
          errors={errors}
          custom={custom}
          pricePlaceholder={product && !product.price ? "Produkt nie ma ceny" : undefined}
        />
      )}
    </ItemDialog>
  )
}

// Wyszukiwarka produktów sprzedawalnych (nazwa, SKU, EAN) - wyniki z serwera po chwili od wpisania.
function ProductSearch({ orderId, onChoose }: { orderId: number; onChoose: (hit: ProductHit) => void }) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<ProductHit[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/orders/${orderId}/items/products?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then(setHits)
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [orderId, query])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie, SKU lub EAN"
          aria-label="Szukaj produktu"
          className="pl-8"
          autoFocus
        />
      </div>
      <ul className="max-h-64 overflow-y-auto rounded-lg border">
        {hits?.length === 0 && <li className="text-muted-foreground px-3 py-3 text-sm">Brak pasujących produktów</li>}
        {hits?.map((hit) => (
          <li key={hit.id} className="border-b last:border-b-0">
            <button
              type="button"
              onClick={() => onChoose(hit)}
              className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{hit.name}</span>
                <span className="text-muted-foreground truncate text-xs">{hit.sku}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-sm tabular-nums">{hit.price ?? "—"}</span>
                <span className={cn("text-xs tabular-nums", hit.available > 0 ? "text-muted-foreground" : "text-destructive")}>
                  {hit.available} szt.
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EditItemDialog({ orderId, item, stockLocked, onClose }: { orderId: number; item: OrderItem; stockLocked: boolean; onClose: () => void }) {
  const form = useForm<ItemForm>({
    product_id: "",
    name: item.name,
    sku: item.sku ?? "",
    quantity: String(item.quantity),
    unit_price: item.unitPriceInput,
    tax_rate: String(item.tax_rate),
  })
  const errors = form.errors as FormErrors

  const submit = () => {
    form.transform((data) =>
      item.catalog
        ? { quantity: data.quantity, unit_price: data.unit_price }
        : { name: data.name, sku: data.sku, quantity: data.quantity, unit_price: data.unit_price, tax_rate: data.tax_rate },
    )
    form.patch(`/orders/${orderId}/items/${item.id}`, { preserveScroll: true, preserveState: "errors", onSuccess: onClose })
  }

  return (
    <ItemDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={item.catalog ? item.name : "Edytuj pozycję"}
      onSubmit={submit}
      processing={form.processing}
      baseError={errorText(errors, "base")}
      submitLabel="Zapisz"
    >
      <ItemFields
        data={form.data}
        setData={(key, value) => form.setData(key, value)}
        errors={errors}
        custom={!item.catalog}
        quantityLocked={stockLocked && item.catalog}
      />
    </ItemDialog>
  )
}
