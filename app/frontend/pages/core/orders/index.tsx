import { Head } from "@inertiajs/react"
import { PackageIcon } from "lucide-react"

import { columnHelper, DataTable } from "@/components/data-table/data-table"
import { EmptyState } from "@/components/data-table/empty-state"
import { PageBar } from "@/components/page-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Order = {
  id: number
  number: string
  source: string
  customer: string
  total: string
  status: string
}

const col = columnHelper<Order>()
const columns = col.columns([
  col.accessor("number", { header: "Numer", meta: { className: "font-medium" } }),
  col.accessor("source", { header: "Źródło" }),
  col.accessor("customer", { header: "Klient" }),
  col.accessor("status", { header: "Status" }),
  col.accessor("total", { header: "Wartość", meta: { align: "right" } }),
])

export default function OrdersIndex({ orders }: { orders: Order[] }) {
  return (
    <>
      <Head title="Zamówienia" />
      <PageBar
        breadcrumbs={[{ label: "Zamówienia" }]}
        actions={
          <Button variant="outline" disabled>
            Nowe zamówienie
          </Button>
        }
      />

      <Card className="gap-0 py-0">
        <DataTable
          data={orders}
          columns={columns}
          rowId={(order) => order.id}
          empty={<EmptyState icon={PackageIcon} title="Brak zamówień" description="Pojawią się tu zamówienia z podłączonych kanałów i z transmisji live." />}
        />
      </Card>
    </>
  )
}
