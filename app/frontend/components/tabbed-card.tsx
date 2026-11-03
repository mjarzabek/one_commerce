import type { ReactNode } from "react"

import { TabNav, type TabItem } from "@/components/tab-nav"
import { Card } from "@/components/ui/card"

// Biała karta z zakładkami na górze i treścią zakładki pod nimi (edycja produktu, wariantu).
// Karty wewnątrz (panele zakładek) tracą własną ramkę i cień - stają się sekcjami tej karty,
// kolejne oddziela linia.
export function TabbedCard({
  label,
  items,
  value,
  onChange,
  children,
}: {
  label: string
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <Card className="gap-0 py-0 **:data-[slot=card]:rounded-none **:data-[slot=card]:bg-transparent **:data-[slot=card]:shadow-none **:data-[slot=card]:ring-0 [&_[data-slot=card]+[data-slot=card]]:border-t">
      <TabNav label={label} items={items} value={value} onChange={onChange} className="mt-0 px-2" />
      {children}
    </Card>
  )
}
