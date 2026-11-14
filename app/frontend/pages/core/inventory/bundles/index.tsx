import { Head } from "@inertiajs/react"
import { BoxesIcon } from "lucide-react"

import { EmptyState } from "@/components/data-table/empty-state"
import { FullBleed, fullBleedTabsClass } from "@/components/full-bleed"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { PageBar } from "@/components/page-bar"

// Zakładka „Zestawy” - zapowiedź, zestawy jeszcze nie istnieją.
export default function InventoryBundles() {
  return (
    <>
      <Head title="Zestawy" />
      <PageBar breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Zestawy" }]} />
      <FullBleed>
        <InventoryTabs className={fullBleedTabsClass} />
        <div className="mx-auto max-w-md px-(--table-inset) py-16">
          <EmptyState
            icon={BoxesIcon}
            title="Zestawy - wkrótce"
            description="Zestaw połączy kilka produktów w jedną pozycję sprzedaży - ze wspólną ceną i stanem liczonym ze stanów produktów składowych."
          />
        </div>
      </FullBleed>
    </>
  )
}
