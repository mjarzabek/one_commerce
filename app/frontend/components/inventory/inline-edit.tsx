import { useForm } from "@inertiajs/react"
import { LockIcon, PencilIcon } from "lucide-react"
import { useRef, useState } from "react"

import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Wartość w komórce tabeli zmieniana w miejscu: klik → pole; Enter / wyjście z pola zapisuje, Esc anuluje.
// `param` - nazwa pola wysyłanego (i błędu zwracanego) przez serwer, `data` - pozostałe parametry żądania.
function InlineEdit({
  url,
  param,
  data,
  initial,
  label,
  title,
  inputMode,
  inputClassName,
  children,
}: {
  url: string
  param: string
  data: Record<string, number>
  initial: string
  label: string
  title: string
  inputMode: "decimal" | "numeric"
  inputClassName?: string
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const skipBlur = useRef(false)
  const form = useForm<Record<string, string | number>>({ [param]: initial, ...data })
  const value = String(form.data[param] ?? "")
  const error = form.errors[param]

  const start = () => {
    form.setData({ [param]: initial, ...data })
    form.clearErrors()
    skipBlur.current = false
    setEditing(true)
  }
  const cancel = () => {
    skipBlur.current = true
    setEditing(false)
  }
  const save = () => {
    if (value.trim() === initial) return cancel()
    form.patch(url, { preserveScroll: true, preserveState: true, onSuccess: cancel })
  }

  if (!editing) {
    return (
      <button
        type="button"
        title={title}
        onClick={start}
        className="group/edit hover:bg-background hover:ring-input -mx-1.5 inline-flex max-w-full cursor-pointer items-center justify-end gap-1 rounded-md px-1.5 py-0.5 tabular-nums hover:ring-1"
      >
        <PencilIcon className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover/edit:opacity-100" aria-hidden />
        {/* Przerywane podkreślenie - widoczny bez najeżdżania znak, że wartość można zmienić. */}
        <span className="decoration-muted-foreground/60 truncate underline decoration-dashed underline-offset-4 group-hover/edit:decoration-transparent">
          {children}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        autoFocus
        inputMode={inputMode}
        aria-label={label}
        aria-invalid={!!error}
        className={cn("h-7 text-right tabular-nums", inputClassName)}
        value={value}
        disabled={form.processing}
        onFocus={(e) => e.target.select()}
        onChange={(e) => form.setData(param, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            save()
          } else if (e.key === "Escape") {
            cancel()
          }
        }}
        onBlur={() => !skipBlur.current && !form.processing && save()}
      />
      {error && <FieldError className="text-right text-xs">{error}</FieldError>}
    </div>
  )
}

// Cena produktu sprzedawalnego w wybranej grupie cenowej. Puste pole usuwa cenę z grupy.
export function InlinePrice({
  productId,
  name,
  priceGroupId,
  label,
  input,
}: {
  productId: number
  name: string
  priceGroupId: number
  label: string | null
  input: string | null
}) {
  return (
    <InlineEdit
      url={`/inventory/products/${productId}/price`}
      param="price"
      data={{ price_group_id: priceGroupId }}
      initial={input ?? ""}
      label={`Cena - ${name}`}
      title="Kliknij, aby zmienić cenę"
      inputMode="decimal"
      inputClassName="w-28"
    >
      {label ?? "-"}
    </InlineEdit>
  )
}

// Stan na liście: dostępne sztuki i rezerwacje, np. „5 (+2)”.
export function StockValue({ available, reserved }: { available: number; reserved: number }) {
  return (
    <span className="tabular-nums" title={reserved > 0 ? `Dostępne ${available}, zarezerwowane ${reserved}` : undefined}>
      {available}
      {reserved > 0 && <span className="text-muted-foreground ml-1 inline-block text-xs font-normal">(+{reserved})</span>}
    </span>
  )
}

// Dostępne sztuki produktu sprzedawalnego w jednym magazynie. Rezerwacje zostają - zmienia się stan fizyczny.
export function InlineStock({
  productId,
  name,
  warehouseId,
  available,
  reserved,
}: {
  productId: number
  name: string
  warehouseId: number
  available: number
  reserved: number
}) {
  return (
    <InlineEdit
      url={`/inventory/products/${productId}/available`}
      param="available"
      data={{ warehouse_id: warehouseId }}
      initial={String(available)}
      label={`Dostępne - ${name}`}
      title="Kliknij, aby zmienić stan"
      inputMode="numeric"
      inputClassName="w-20"
    >
      <StockValue available={available} reserved={reserved} />
    </InlineEdit>
  )
}

// Stan w magazynie ze ścisłą kontrolą - tylko do odczytu.
export function LockedStock({ available, reserved }: { available: number; reserved: number }) {
  return (
    <span className="inline-flex items-center gap-1" title="Ścisła kontrola - stan zmienisz tylko dokumentem magazynowym">
      <LockIcon className="text-muted-foreground size-3" aria-label="Ścisła kontrola magazynowa" />
      <StockValue available={available} reserved={reserved} />
    </span>
  )
}
