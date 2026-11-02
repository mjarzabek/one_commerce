import { usePage } from "@inertiajs/react"
import { BookCopyIcon, ShirtIcon, TagsIcon, WarehouseIcon } from "lucide-react"

import { TabNav } from "@/components/tab-nav"

const TABS = [
  { value: "products", label: "Produkty", icon: ShirtIcon, href: "/inventory", match: (url: string) => url === "/inventory" || url.startsWith("/inventory?") },
  { value: "catalogs", label: "Katalogi", icon: BookCopyIcon, href: "/inventory/catalogs", match: (url: string) => url.startsWith("/inventory/catalogs") },
  { value: "warehouses", label: "Magazyny", icon: WarehouseIcon, href: "/inventory/warehouses", match: (url: string) => url.startsWith("/inventory/warehouses") },
  { value: "prices", label: "Ceny", icon: TagsIcon, href: "/inventory/prices", match: (url: string) => url.startsWith("/inventory/prices") },
]

// Zakładki sekcji Magazyn: Produkty | Katalogi | Magazyny | Ceny.
export function InventoryTabs() {
  const { url } = usePage()
  const active = TABS.find((tab) => tab.match(url))?.value ?? "products"

  return <TabNav label="Sekcje magazynu" items={TABS} value={active} />
}
