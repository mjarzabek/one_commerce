import { Head } from "@inertiajs/react"
import { PackageIcon } from "lucide-react"

import { PageBar } from "@/components/page-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Order = {
  id: number
  number: string
  source: string
  customer: string
  total: string
  status: string
}

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

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Numer</TableHead>
              <TableHead>Źródło</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Wartość</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48">
                  <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <PackageIcon className="size-6" />
                    <p className="text-foreground font-medium">Brak zamówień</p>
                    <p className="text-sm">Pojawią się tu zamówienia z podłączonych kanałów i z transmisji live.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="pl-4 font-medium">{order.number}</TableCell>
                  <TableCell>{order.source}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{order.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
