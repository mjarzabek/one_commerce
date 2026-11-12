import { CheckIcon } from "lucide-react"
import { Fragment } from "react"

import { StatusDot } from "@/components/orders/status-badge"
import type { OrderStatus, StatusTree } from "@/components/orders/types"
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

// Pozycje menu wyboru statusu (do DropdownMenuContent): statusy pogrupowane jak w ustawieniach.
export function StatusMenuItems({ tree, current, onSelect }: { tree: StatusTree; current?: number; onSelect: (status: OrderStatus) => void }) {
  const item = (status: OrderStatus) => (
    <DropdownMenuItem key={status.id} onClick={() => onSelect(status)} disabled={status.id === current}>
      <StatusDot color={status.color} className="mx-1" />
      <span className="flex-1 truncate">{status.name}</span>
      {status.id === current && <CheckIcon />}
    </DropdownMenuItem>
  )
  const sections = [
    ...tree.groups.filter((group) => group.statuses.length > 0),
    ...(tree.ungrouped.length ? [{ id: 0, name: "", statuses: tree.ungrouped }] : []),
  ]

  return sections.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 && <DropdownMenuSeparator />}
      <DropdownMenuGroup>
        {group.name && <DropdownMenuLabel>{group.name}</DropdownMenuLabel>}
        {group.statuses.map(item)}
      </DropdownMenuGroup>
    </Fragment>
  ))
}
