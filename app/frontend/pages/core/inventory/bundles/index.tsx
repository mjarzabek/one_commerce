import { Head } from "@inertiajs/react"
import { BoxesIcon } from "lucide-react"

import { PageBar } from "@/components/page-bar"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Zakładka „Zestawy” – zapowiedź, zestawy jeszcze nie istnieją.
export default function InventoryBundles() {
  return (
    <>
      <Head title="Zestawy" />
      <PageBar breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Zestawy" }]} />
      <InventoryTabs />

      <Card>
        <CardHeader className="items-center text-center">
          <div className="bg-muted mx-auto mb-2 flex size-10 items-center justify-center rounded-lg">
            <BoxesIcon className="size-5" />
          </div>
          <CardTitle>Zestawy – wkrótce</CardTitle>
          <CardDescription>
            Zestaw połączy kilka produktów w jedną pozycję sprzedaży – ze wspólną ceną i stanem liczonym ze stanów produktów składowych.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}
