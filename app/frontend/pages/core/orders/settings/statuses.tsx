import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Head, router } from "@inertiajs/react"
import { FolderPlusIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InfoBox } from "@/components/info-box"
import { NameDialog } from "@/components/inventory/name-dialog"
import { errorText, type FormErrors } from "@/components/inventory/types"
import { OptionSelect } from "@/components/option-select"
import { OrdersSettingsTabs } from "@/components/orders/settings-tabs"
import { STATUS_COLOR_LABELS, STATUS_DOTS, StatusDot } from "@/components/orders/status-badge"
import { ordersWord, type OrderStatus, type StatusColor, type StatusGroup, type StatusTree } from "@/components/orders/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { DragGrip, NoDrag, sortableContextProps, sortableStyle, useSortableSensors } from "@/components/sortable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { plural } from "@/lib/plural"
import { cn } from "@/lib/utils"

type Props = { tree: StatusTree; colors: StatusColor[] }

type DialogForm = {
  data: Record<string, string | string[] | boolean>
  setData: (key: string, value: string | string[] | boolean) => void
  errors: FormErrors
}

// Wartość „Bez grupy” w selekcie (Base UI Select nie przyjmuje pustej wartości) - wysyłana jako "".
const NO_GROUP = "none"
const BASE = "/orders/settings"
const patch = (url: string, data: Record<string, string> = {}) => router.patch(url, data, { preserveScroll: true })

export default function OrdersSettingsStatuses({ tree, colors }: Props) {
  // Pola okna statusu: grupa i kolor.
  const statusFields = ({ data, setData, errors }: DialogForm) => (
    <>
      <Field>
        <FieldLabel htmlFor="status-group">Grupa</FieldLabel>
        <OptionSelect
          id="status-group"
          options={[
            { value: NO_GROUP, label: "Bez grupy" },
            ...tree.groups.map((group) => ({
              value: String(group.id),
              label: group.name,
            })),
          ]}
          value={String(data.group_id || NO_GROUP)}
          onChange={(value) => setData("group_id", value === NO_GROUP ? "" : value)}
        />
      </Field>
      <Field data-invalid={!!errorText(errors, "color")}>
        <FieldLabel>Kolor</FieldLabel>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kolor">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={data.color === color}
              aria-label={STATUS_COLOR_LABELS[color]}
              title={STATUS_COLOR_LABELS[color]}
              onClick={() => setData("color", color)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border",
                data.color === color ? "border-foreground ring-ring/50 ring-2" : "hover:border-foreground/40",
              )}
            >
              <span className={cn("size-4 rounded-full", STATUS_DOTS[color])} />
            </button>
          ))}
        </div>
        <FieldError>{errorText(errors, "color")}</FieldError>
      </Field>
    </>
  )

  return (
    <>
      <Head title="Statusy zamówień" />
      <PageBar
        breadcrumbs={[{ label: "Zamówienia", href: "/orders" }, { label: "Ustawienia", href: "/orders/settings" }, { label: "Statusy" }]}
        actions={
          <>
            <NameDialog
              title="Nowa grupa statusów"
              action={`${BASE}/groups`}
              initial={{ name: "" }}
              submitLabel="Dodaj grupę"
              trigger={
                <Button variant="outline">
                  <FolderPlusIcon />
                  Dodaj grupę
                </Button>
              }
            />
            <NameDialog
              title="Nowy status"
              action={`${BASE}/statuses`}
              initial={{
                name: "",
                group_id: tree.groups[0] ? String(tree.groups[0].id) : "",
                color: "blue",
              }}
              submitLabel="Dodaj status"
              trigger={
                <Button>
                  <PlusIcon />
                  Dodaj status
                </Button>
              }
            >
              {statusFields}
            </NameDialog>
          </>
        }
      />
      <Card className="gap-0 py-0">
        <OrdersSettingsTabs className="mt-0 px-2" />
        <div className="border-b p-4">
          <InfoBox title="Statusy pokazują, na jakim etapie jest zamówienie">
            <p>
              Grupy zbierają kilka statusów pod jedną pozycją na liście zamówień, np. „Do realizacji”. Nowe zamówienia dostają status oznaczony jako
              domyślny.
            </p>
            <p>Przeciągnij wiersz, aby zmienić kolejność albo przenieść status do innej grupy.</p>
          </InfoBox>
        </div>
        <div className={cn(ROW, "bg-muted/50 text-foreground h-10 text-sm font-medium")}>
          <span className="pl-6">Status</span>
          <span className="text-right">Zamówienia</span>
          <span />
        </div>
        <StatusBoard tree={tree} fields={statusFields} />
      </Card>
    </>
  )
}

// Wiersz listy: nazwa | liczba zamówień | akcje.
const ROW = "grid grid-cols-[minmax(0,1fr)_7rem_3rem] items-center gap-2 border-b px-4"

// Układ listy do przeciągania: kolejność grup i statusy w sekcjach (klucz: id grupy albo NONE - bez grupy).
type Layout = { groups: number[]; sections: Record<string, number[]> }
const NONE = "none"

const toLayout = (tree: StatusTree): Layout => ({
  groups: tree.groups.map((group) => group.id),
  sections: {
    [NONE]: tree.ungrouped.map((status) => status.id),
    ...Object.fromEntries(tree.groups.map((group) => [String(group.id), group.statuses.map((status) => status.id)])),
  },
})

// Id elementów dnd-kit: "g:1" - grupa, "s:5" - status, "c:1" / "c:none" - sekcja (miejsce upuszczenia statusu).
type DragData = { type: "group"; id: number } | { type: "status"; id: number } | { type: "section"; key: string }

// Statusy: przeciąganie grup (z ich statusami), statusów w grupie i między grupami (także do „Bez grupy”).
function StatusBoard({ tree, fields }: { tree: StatusTree; fields: (form: DialogForm) => React.ReactNode }) {
  const [layout, setLayout] = useState(() => toLayout(tree))
  const [active, setActive] = useState<DragData | null>(null)
  const snapshot = useRef(layout)
  const sensors = useSortableSensors()
  useEffect(() => setLayout(toLayout(tree)), [tree])

  const groups = new Map(tree.groups.map((group) => [group.id, group]))
  const statuses = new Map([...tree.ungrouped, ...tree.groups.flatMap((group) => group.statuses)].map((status) => [status.id, status]))
  const sectionOf = (layout: Layout, id: number) => Object.keys(layout.sections).find((key) => layout.sections[key].includes(id))
  const data = (item: { data: { current?: unknown } } | null) => (item?.data.current ?? null) as DragData | null

  // Grupę można upuścić tylko między grupami, status - na status albo w sekcję (także pustą).
  const collisions: CollisionDetection = (args) => {
    const type = data(args.active)?.type
    const droppableContainers = args.droppableContainers.filter((container) => {
      const target = data(container)?.type
      return type === "group" ? target === "group" : target === "status" || target === "section"
    })
    if (type === "group") return closestCenter({ ...args, droppableContainers })
    const hits = pointerWithin({ ...args, droppableContainers })
    const onStatus = hits.filter((hit) => String(hit.id).startsWith("s:"))
    if (onStatus.length > 0) return onStatus
    return hits.length > 0 ? hits : closestCenter({ ...args, droppableContainers })
  }

  // Status nad inną sekcją przechodzi do niej od razu (podgląd); kolejność w sekcji ustala się przy upuszczeniu.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const dragged = data(active)
    const target = data(over)
    if (dragged?.type !== "status" || !target) return
    setLayout((current) => {
      const from = sectionOf(current, dragged.id)
      const to = target.type === "section" ? target.key : target.type === "status" ? sectionOf(current, target.id) : undefined
      if (!from || !to || from === to) return current
      const items = current.sections[to]
      const index = target.type === "status" ? items.indexOf(target.id) : items.length
      return {
        ...current,
        sections: {
          ...current.sections,
          [from]: current.sections[from].filter((id) => id !== dragged.id),
          [to]: [...items.slice(0, index), dragged.id, ...items.slice(index)],
        },
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null)
    const dragged = data(active)
    const target = data(over)
    let next = layout
    if (dragged?.type === "group" && target?.type === "group") {
      next = { ...layout, groups: arrayMove(layout.groups, layout.groups.indexOf(dragged.id), layout.groups.indexOf(target.id)) }
    } else if (dragged?.type === "status" && target?.type === "status") {
      const key = sectionOf(layout, dragged.id)
      if (key && key === sectionOf(layout, target.id)) {
        const items = layout.sections[key]
        next = { ...layout, sections: { ...layout.sections, [key]: arrayMove(items, items.indexOf(dragged.id), items.indexOf(target.id)) } }
      }
    }
    setLayout(next)
    if (JSON.stringify(next) === JSON.stringify(snapshot.current)) return

    router.patch(
      `${BASE}/statuses/reorder`,
      {
        groups: next.groups,
        sections: [NONE, ...next.groups.map(String)].map((key) => ({ group_id: key === NONE ? null : Number(key), statuses: next.sections[key] ?? [] })),
      },
      { preserveScroll: true, preserveState: true, onError: () => setLayout(snapshot.current) },
    )
  }

  const statusRows = (key: string) =>
    (layout.sections[key] ?? []).flatMap((id) => {
      const status = statuses.get(id)
      return status ? [<SortableStatus key={id} status={status} fields={fields} />] : []
    })

  const draggedStatus = active?.type === "status" ? statuses.get(active.id) : undefined
  const draggedGroup = active?.type === "group" ? groups.get(active.id) : undefined
  // „Bez grupy” widać, gdy są tam statusy albo właśnie przeciągany jest status (żeby dało się go tam upuścić).
  const showUngrouped = (layout.sections[NONE]?.length ?? 0) > 0 || active?.type === "status"

  return (
    <DndContext
      {...sortableContextProps}
      sensors={sensors}
      collisionDetection={collisions}
      onDragStart={({ active }) => {
        snapshot.current = layout
        setActive(data(active))
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null)
        setLayout(snapshot.current)
      }}
    >
      {showUngrouped && (
        <Section sectionKey={NONE}>
          <div className={cn(ROW, "bg-muted/30 h-11")}>
            <span className="text-muted-foreground pl-6 text-sm">Bez grupy</span>
          </div>
          <SortableContext items={(layout.sections[NONE] ?? []).map((id) => `s:${id}`)} strategy={verticalListSortingStrategy}>
            {statusRows(NONE)}
          </SortableContext>
        </Section>
      )}
      <SortableContext items={layout.groups.map((id) => `g:${id}`)} strategy={verticalListSortingStrategy}>
        {layout.groups.map((id) => {
          const group = groups.get(id)
          if (!group) return null
          const ids = layout.sections[String(id)] ?? []
          return (
            <SortableGroup key={id} group={group} count={ids.reduce((sum, statusId) => sum + (statuses.get(statusId)?.count ?? 0), 0)}>
              <SortableContext items={ids.map((statusId) => `s:${statusId}`)} strategy={verticalListSortingStrategy}>
                {ids.length === 0 ? (
                  <div className={cn(ROW, "text-muted-foreground h-11 text-sm")}>
                    <span className="pl-10">Brak statusów w grupie.</span>
                  </div>
                ) : (
                  statusRows(String(id))
                )}
              </SortableContext>
            </SortableGroup>
          )
        })}
      </SortableContext>
      <DragOverlay>
        {draggedStatus && (
          <div className={cn(ROW, "bg-card h-11 rounded-md border shadow-lg")}>
            <StatusLabel status={draggedStatus} />
          </div>
        )}
        {draggedGroup && (
          <div className={cn(ROW, "bg-card h-11 rounded-md border shadow-lg")}>
            <span className="flex items-center gap-2 font-medium">
              <DragGrip />
              {draggedGroup.name}
              <span className="text-muted-foreground text-sm font-normal">
                {draggedGroup.statuses.length} {plural(draggedGroup.statuses.length, ["status", "statusy", "statusów"])}
              </span>
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// Sekcja, w którą można upuścić status (cała - razem z nagłówkiem, także gdy pusta).
function Section({ sectionKey, children, className }: { sectionKey: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef } = useDroppable({ id: `c:${sectionKey}`, data: { type: "section", key: sectionKey } })
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  )
}

function SortableGroup({ group, count, children }: { group: StatusGroup; count: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g:${group.id}`,
    data: { type: "group", id: group.id },
  })
  const droppable = useDroppable({ id: `c:${group.id}`, data: { type: "section", key: String(group.id) } })

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        droppable.setNodeRef(node)
      }}
      style={sortableStyle(transform, transition)}
      className={cn("bg-card relative", isDragging && "z-10 opacity-40")}
    >
      <div {...attributes} {...listeners} className={cn(ROW, "bg-muted/30 h-11 cursor-grab touch-none active:cursor-grabbing")}>
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <DragGrip />
          <span className="truncate">{group.name}</span>
        </span>
        <span className="text-muted-foreground text-right text-sm tabular-nums">{count}</span>
        <NoDrag className="text-right">
          <GroupActions group={group} />
        </NoDrag>
      </div>
      {children}
    </div>
  )
}

function StatusLabel({ status }: { status: OrderStatus }) {
  return (
    <span className="flex min-w-0 items-center gap-2 pl-6">
      <StatusDot color={status.color} />
      <span className="truncate">{status.name}</span>
      {status.default && <Badge variant="secondary">Domyślny</Badge>}
    </span>
  )
}

function SortableStatus({ status, fields }: { status: OrderStatus; fields: (form: DialogForm) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `s:${status.id}`,
    data: { type: "status", id: status.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle(transform, transition)}
      {...attributes}
      {...listeners}
      className={cn(ROW, "bg-card hover:bg-muted/40 relative h-11 cursor-grab touch-none active:cursor-grabbing", isDragging && "z-10 opacity-40")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <DragGrip />
        <StatusLabel status={status} />
      </span>
      <span className="text-right text-sm tabular-nums">{status.count ?? 0}</span>
      <NoDrag className="text-right">
        <StatusActions status={status} fields={fields} />
      </NoDrag>
    </div>
  )
}

// Akcje statusu (⋯): edycja, ustawienie jako domyślny, usunięcie (nie domyślnego i bez zamówień).
function StatusActions({ status, fields }: { status: OrderStatus; fields: (form: DialogForm) => React.ReactNode }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const count = status.count ?? 0
  const url = `${BASE}/statuses/${status.id}`

  return (
    <>
      <RowActions
        actions={[
          {
            label: "Edytuj",
            icon: PencilIcon,
            onSelect: () => setDialog("edit"),
          },
          {
            label: "Ustaw jako domyślny",
            icon: StarIcon,
            hidden: status.default,
            onSelect: () => patch(`${url}/default`),
          },
          {
            label: "Usuń",
            icon: Trash2Icon,
            destructive: true,
            disabled: status.default || count > 0,
            onSelect: () => setDialog("delete"),
          },
        ]}
      />
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={close}
        title={`Status „${status.name}”`}
        action={url}
        method="patch"
        initial={{
          name: status.name,
          group_id: status.group_id ? String(status.group_id) : "",
          color: status.color,
        }}
      >
        {fields}
      </NameDialog>
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć status „${status.name}”?`}
        description={count > 0 ? `Status ma ${count} ${plural(count, ordersWord)}.` : "Żadne zamówienie nie ma tego statusu."}
        url={url}
      />
    </>
  )
}

// Akcje grupy (⋯): zmiana nazwy, usunięcie (statusy zostają, bez grupy).
function GroupActions({ group }: { group: StatusGroup }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const url = `${BASE}/groups/${group.id}`

  return (
    <>
      <RowActions
        actions={[
          {
            label: "Zmień nazwę",
            icon: PencilIcon,
            onSelect: () => setDialog("edit"),
          },
          {
            label: "Usuń",
            icon: Trash2Icon,
            destructive: true,
            onSelect: () => setDialog("delete"),
          },
        ]}
      />
      <NameDialog open={dialog === "edit"} onOpenChange={close} title={`Grupa „${group.name}”`} action={url} method="patch" initial={{ name: group.name }} />
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć grupę „${group.name}”?`}
        description={group.statuses.length > 0 ? "Statusy z tej grupy zostaną bez grupy. Zamówienia nie zmienią statusu." : "Grupa jest pusta."}
        url={url}
      />
    </>
  )
}
