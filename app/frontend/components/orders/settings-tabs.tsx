import { usePage } from "@inertiajs/react"
import { ListPlusIcon, TagsIcon } from "lucide-react"

import { TabNav } from "@/components/tab-nav"

const TABS = [
  { value: "statuses", label: "Statusy", icon: TagsIcon, href: "/orders/settings/statuses" },
  { value: "fields", label: "Pola dodatkowe", icon: ListPlusIcon, href: "/orders/settings/fields" },
]

// Zakładki ustawień zamówień: Statusy | Pola dodatkowe.
export function OrdersSettingsTabs({ className }: { className?: string }) {
  const { url } = usePage()
  return <TabNav label="Ustawienia zamówień" items={TABS} value={TABS.find((tab) => url.startsWith(tab.href))?.value ?? "statuses"} className={className} />
}
