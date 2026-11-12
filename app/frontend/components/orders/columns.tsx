import { Link } from "@inertiajs/react"

import { columnHelper } from "@/components/data-table/data-table"
import { SortableHeader, SortMenuHeader, type SortOption } from "@/components/data-table/sortable-header"
import { PaymentBadge } from "@/components/orders/payment-badge"
import { OrderStatusBadge } from "@/components/orders/status-badge"
import type { Customer, OrderStatus, Payment } from "@/components/orders/types"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/plural"

export type OrderRow = {
  id: number
  number: string
  placed_at: string
  source: string
  source_channel: string | null
  customer: Customer
  items: { count: number; first: string | null; more: number }
  total: string
  payment: Payment
  status: OrderStatus
}

const col = columnHelper<OrderRow>()

const twoLineSkeleton = (
  <div className="flex flex-col gap-1.5">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-3 w-16" />
  </div>
)

const formatPlaced = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

// Sortowanie kolumny „Zamówienie” (numer, data i źródło w jednej komórce).
const ORDER_SORTS: SortOption[] = [
  { field: "placed_at", dir: "desc", label: "Najnowsze" },
  { field: "placed_at", dir: "asc", label: "Najstarsze" },
  { field: "number", dir: "desc", label: "Numer malejąco" },
  { field: "number", dir: "asc", label: "Numer rosnąco" },
]

// Kolumny listy zamówień. Id kolumn z sortowaniem = pola sortowania w Orders::OrderSearch.
// `listQuery` - parametry bieżącej listy doklejane do linku zamówienia (strzałki i powrót na karcie). Wywoływać w useMemo.
export const orderColumns = (listQuery: string) =>
  col.columns([
    col.display({
      id: "order",
      header: (context) => (
        <SortMenuHeader context={context} options={ORDER_SORTS}>
          Zamówienie
        </SortMenuHeader>
      ),
      meta: { width: "w-52", skeleton: twoLineSkeleton },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/orders/${row.original.id}${listQuery ? `?${listQuery}` : ""}`} className="font-medium whitespace-nowrap hover:underline">
            {row.original.number}
          </Link>
          <span className="text-muted-foreground truncate text-xs tabular-nums">
            {[formatPlaced(row.original.placed_at), row.original.source_channel ?? row.original.source].join(" · ")}
          </span>
        </div>
      ),
    }),
    col.accessor((row) => row.customer.name, {
      id: "customer",
      header: (context) => <SortableHeader context={context}>Klient</SortableHeader>,
      meta: { skeleton: twoLineSkeleton },
      cell: ({ row }) => {
        const { name, email, phone } = row.original.customer
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{name || "-"}</span>
            {(email || phone) && <span className="text-muted-foreground truncate text-xs">{email || phone}</span>}
          </div>
        )
      },
    }),
    col.display({
      id: "items",
      header: "Produkty",
      meta: { skeleton: twoLineSkeleton },
      cell: ({ row }) => {
        const { count, first, more } = row.original.items
        return (
          <div className="flex max-w-64 min-w-0 flex-col">
            <span className="truncate">{first}</span>
            <span className="text-muted-foreground text-xs">
              {count} szt.
              {more > 0 && ` · +${more} ${plural(more, ["pozycja", "pozycje", "pozycji"])}`}
            </span>
          </div>
        )
      },
    }),
    col.accessor("total", {
      id: "total",
      header: (context) => <SortableHeader context={context}>Wartość</SortableHeader>,
      meta: {
        width: "w-32",
        align: "right",
        className: "tabular-nums font-medium",
      },
    }),
    col.display({
      id: "payment",
      header: "Płatność",
      meta: { width: "w-28" },
      cell: ({ row }) => <PaymentBadge payment={row.original.payment} />,
    }),
    col.display({
      id: "status",
      header: "Status",
      meta: { width: "w-40" },
      cell: ({ row }) => <OrderStatusBadge name={row.original.status.name} color={row.original.status.color} />,
    }),
  ])
