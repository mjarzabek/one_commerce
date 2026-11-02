import { usePage } from "@inertiajs/react"
import { BookCopyIcon, BoxesIcon, SettingsIcon, ShirtIcon, TagsIcon, WarehouseIcon } from "lucide-react"

import { TabNav } from "@/components/tab-nav"

const LIST_TABS = [
  { value: "products", label: "Produkty", icon: ShirtIcon, href: "/inventory" },
  { value: "bundles", label: "Zestawy", icon: BoxesIcon, href: "/inventory/bundles" },
]

const SETTINGS_TABS = [
  { value: "general", label: "Ogólne", icon: SettingsIcon, href: "/inventory/settings/general" },
  { value: "catalogs", label: "Katalogi", icon: BookCopyIcon, href: "/inventory/settings/catalogs" },
  { value: "warehouses", label: "Magazyny", icon: WarehouseIcon, href: "/inventory/settings/warehouses" },
  { value: "prices", label: "Ceny", icon: TagsIcon, href: "/inventory/settings/prices" },
]

const activeTab = (url: string, tabs: { value: string; href: string }[]) =>
  tabs.find((tab) => url === tab.href || url.startsWith(`${tab.href}/`) || url.startsWith(`${tab.href}?`))?.value

// Zakładki listy produktów: Produkty | Zestawy.
export function InventoryTabs({ className }: { className?: string }) {
  const { url } = usePage()
  return <TabNav label="Lista produktów" items={LIST_TABS} value={activeTab(url, LIST_TABS.slice(1)) ?? "products"} className={className} />
}

// Zakładki ustawień produktów: Ogólne | Katalogi | Magazyny | Ceny.
export function InventorySettingsTabs({ className }: { className?: string }) {
  const { url } = usePage()
  return <TabNav label="Ustawienia produktów" items={SETTINGS_TABS} value={activeTab(url, SETTINGS_TABS) ?? "general"} className={className} />
}
