import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Head, router } from "@inertiajs/react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { FullBleed, fullBleedTabsClass } from "@/components/full-bleed"
import { InfoBox } from "@/components/info-box"
import { NameDialog } from "@/components/inventory/name-dialog"
import { errorText, type FormErrors } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import { OrdersSettingsTabs } from "@/components/orders/settings-tabs"
import type { CustomFieldKind } from "@/components/orders/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { DragGrip, NoDrag, sortableContextProps, sortableStyle, useSortableSensors } from "@/components/sortable"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { plural } from "@/lib/plural"
import { cn } from "@/lib/utils"

type CustomField = { id: number; name: string; kind: CustomFieldKind; options: string[]; orders: number }

type Props = { fields: CustomField[]; kinds: Record<CustomFieldKind, string> }

type DialogForm = {
  data: Record<string, string | string[] | boolean>
  setData: (key: string, value: string | string[] | boolean) => void
  errors: FormErrors
}

const BASE = "/orders/settings/fields"

export default function OrdersSettingsFields({ fields, kinds }: Props) {
  // Kolejność po przeciągnięciu - od razu na ekranie, zapis w tle (błąd przywraca poprzednią).
  const [order, setOrder] = useState(() => fields.map((field) => field.id))
  useEffect(() => setOrder(fields.map((field) => field.id)), [fields])
  const sensors = useSortableSensors()
  const byId = new Map(fields.map((field) => [field.id, field]))
  const sorted = order.flatMap((id) => byId.get(id) ?? [])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const previous = order
    const next = arrayMove(order, order.indexOf(Number(active.id)), order.indexOf(Number(over.id)))
    setOrder(next)
    router.patch(`${BASE}/reorder`, { ids: next }, { preserveScroll: true, preserveState: true, onError: () => setOrder(previous) })
  }

  // Pola okna: typ (tylko przy dodawaniu) i wartości listy.
  const fieldForm =
    (editing: boolean) =>
    ({ data, setData, errors }: DialogForm) => (
      <>
        <Field data-invalid={!!errorText(errors, "kind")}>
          <FieldLabel htmlFor="field-kind">Typ</FieldLabel>
          <OptionSelect
            id="field-kind"
            options={Object.entries(kinds).map(([value, label]) => ({ value, label }))}
            value={String(data.kind)}
            onChange={(value) => setData("kind", value)}
            disabled={editing}
          />
          <FieldError>{errorText(errors, "kind")}</FieldError>
        </Field>
        {data.kind === "select" && (
          <Field data-invalid={!!errorText(errors, "options")}>
            <FieldLabel htmlFor="field-options">Wartości listy</FieldLabel>
            <Textarea
              id="field-options"
              rows={4}
              value={String(data.options ?? "")}
              onChange={(e) => setData("options", e.target.value)}
              aria-invalid={!!errorText(errors, "options")}
            />
            <FieldDescription>Jedna wartość w wierszu.</FieldDescription>
            <FieldError>{errorText(errors, "options")}</FieldError>
          </Field>
        )}
      </>
    )

  return (
    <>
      <Head title="Pola dodatkowe zamówień" />
      <PageBar
        breadcrumbs={[{ label: "Zamówienia", href: "/orders" }, { label: "Ustawienia", href: "/orders/settings" }, { label: "Pola dodatkowe" }]}
        actions={
          <NameDialog
            title="Nowe pole dodatkowe"
            action={BASE}
            initial={{ name: "", kind: "text", options: "" }}
            submitLabel="Dodaj pole"
            trigger={
              <Button>
                <PlusIcon />
                Dodaj pole
              </Button>
            }
          >
            {fieldForm(false)}
          </NameDialog>
        }
      />
      <FullBleed>
        <OrdersSettingsTabs className={fullBleedTabsClass} />
        <div className="border-b px-(--table-inset) py-4">
          <InfoBox title="Pola dodatkowe to własne informacje zapisywane przy zamówieniu">
            <p>Np. priorytet, termin wysyłki albo numer reklamacji. Uzupełnia się je na karcie zamówienia w sekcji „Pola dodatkowe”.</p>
            <p>Przeciągnij wiersz, aby zmienić kolejność, w jakiej pola są tam pokazywane.</p>
          </InfoBox>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-[calc(var(--table-inset)+--spacing(6))]">Nazwa</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead className="text-right">Zamówienia</TableHead>
              <TableHead className="w-12 pr-(--table-inset)" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  Brak pól dodatkowych.
                </TableCell>
              </TableRow>
            )}
            <DndContext {...sortableContextProps} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                {sorted.map((field) => (
                  <SortableFieldRow key={field.id} field={field} kind={kinds[field.kind]} form={fieldForm(true)} />
                ))}
              </SortableContext>
            </DndContext>
          </TableBody>
        </Table>
      </FullBleed>
    </>
  )
}

// Wiersz pola - przeciągany za cały wiersz (poza przyciskiem akcji).
function SortableFieldRow({ field, kind, form }: { field: CustomField; kind: string; form: (form: DialogForm) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })

  return (
    <TableRow
      ref={setNodeRef}
      style={sortableStyle(transform, transition)}
      {...attributes}
      {...listeners}
      className={cn("bg-card relative cursor-grab touch-none active:cursor-grabbing", isDragging && "z-10 shadow-lg")}
    >
      <TableCell className="pl-(--table-inset) font-medium">
        <span className="flex items-center gap-2">
          <DragGrip />
          {field.name}
        </span>
      </TableCell>
      <TableCell>
        {kind}
        {field.kind === "select" && <span className="text-muted-foreground ml-2 text-sm">{field.options.join(", ")}</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{field.orders}</TableCell>
      <TableCell className="pr-(--table-inset) text-right">
        <NoDrag>
          <FieldActions field={field} form={form} />
        </NoDrag>
      </TableCell>
    </TableRow>
  )
}

// Akcje pola (⋯): edycja, usunięcie (razem z wartościami w zamówieniach).
function FieldActions({ field, form }: { field: CustomField; form: (form: DialogForm) => React.ReactNode }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const url = `${BASE}/${field.id}`

  return (
    <>
      <RowActions
        actions={[
          { label: "Edytuj", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Usuń", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
        ]}
      />
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={close}
        title={`Pole „${field.name}”`}
        action={url}
        method="patch"
        initial={{ name: field.name, kind: field.kind, options: field.options.join("\n") }}
      >
        {form}
      </NameDialog>
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć pole „${field.name}”?`}
        description={
          field.orders > 0
            ? `Wartość tego pola zniknie z ${field.orders} ${plural(field.orders, ["zamówienia", "zamówień", "zamówień"])}.`
            : "Żadne zamówienie nie ma wartości tego pola."
        }
        url={url}
      />
    </>
  )
}
