import { ArchiveIcon, ChevronRightIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { StatusDot } from "@/components/orders/status-badge"
import type { OrderStatus, StatusGroup, StatusTree } from "@/components/orders/types"
import { OptionSelect } from "@/components/option-select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

// Wybór z listy: wszystkie zamówienia, cała grupa albo jeden status.
export type StatusSelection = { status: number | null; group: number | null }

type Props = {
  tree: StatusTree
  total: number
  value: StatusSelection
  onChange: (value: StatusSelection) => void
}

const groupCount = (group: StatusGroup) => group.statuses.reduce((sum, status) => sum + (status.count ?? 0), 0)

function Item({
  label,
  count,
  active,
  onClick,
  dot,
  className,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  dot?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        "hover:bg-foreground/5 flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px]",
        active && "bg-foreground/8 hover:bg-foreground/8 font-medium",
        className,
      )}
    >
      {dot}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
    </button>
  )
}

// Lista statusów po lewej stronie listy zamówień: „Wszystkie”, grupy (rozwijane, z sumą) i statusy z licznikami.
// Na wąskim ekranie - select nad tabelą.
export function StatusSidebar({ tree, total, value, onChange }: Props) {
  const statusItem = (status: OrderStatus, nested: boolean) => (
    <Item
      key={status.id}
      label={status.name}
      count={status.count ?? 0}
      active={value.status === status.id}
      onClick={() => onChange({ status: status.id, group: null })}
      dot={<StatusDot color={status.color} />}
      className={nested ? "pl-6" : undefined}
    />
  )

  return (
    <nav aria-label="Statusy zamówień" className="flex flex-col gap-0.5">
      <Item label="Wszystkie" count={total} active={!value.status && !value.group} onClick={() => onChange({ status: null, group: null })} />
      {tree.ungrouped.map((status) => statusItem(status, false))}
      {tree.groups.map((group) => (
        <GroupItem key={group.id} group={group} value={value} onChange={onChange}>
          {group.statuses.map((status) => statusItem(status, true))}
        </GroupItem>
      ))}
      <div className="bg-border mx-2 my-2 h-px" />
      {/* Archiwum i kosz - jeszcze bez obsługi po stronie serwera. */}
      <FooterItem icon={ArchiveIcon} label="Archiwum" />
      <FooterItem icon={Trash2Icon} label="Kosz" />
    </nav>
  )
}

function FooterItem({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Wkrótce"
      className="text-muted-foreground flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] disabled:cursor-not-allowed"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function GroupItem({
  group,
  value,
  onChange,
  children,
}: {
  group: StatusGroup
  value: StatusSelection
  onChange: Props["onChange"]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <div className="flex items-center">
        <CollapsibleTrigger
          className="text-muted-foreground hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-md"
          aria-label={open ? `Zwiń grupę ${group.name}` : `Rozwiń grupę ${group.name}`}
        >
          <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </CollapsibleTrigger>
        <Item
          label={group.name}
          count={groupCount(group)}
          active={value.group === group.id}
          onClick={() => onChange({ status: null, group: group.id })}
          className="pl-1 font-semibold"
        />
      </div>
      <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">{children}</CollapsibleContent>
    </Collapsible>
  )
}

// Wybór statusu na wąskim ekranie (zamiast listy po lewej).
export function StatusSelect({ tree, total, value, onChange }: Props) {
  const options = [
    { value: "all", label: `Wszystkie (${total})` },
    ...tree.ungrouped.map((status) => ({
      value: `s${status.id}`,
      label: `${status.name} (${status.count ?? 0})`,
    })),
    ...tree.groups.flatMap((group) => [
      { value: `g${group.id}`, label: `${group.name} (${groupCount(group)})` },
      ...group.statuses.map((status) => ({
        value: `s${status.id}`,
        label: `   ${status.name} (${status.count ?? 0})`,
      })),
    ]),
  ]
  const current = value.status ? `s${value.status}` : value.group ? `g${value.group}` : "all"

  return (
    <OptionSelect
      label="Status"
      options={options}
      value={current}
      onChange={(next) =>
        onChange(
          next === "all"
            ? { status: null, group: null }
            : next.startsWith("g")
              ? { status: null, group: Number(next.slice(1)) }
              : { status: Number(next.slice(1)), group: null },
        )
      }
    />
  )
}
