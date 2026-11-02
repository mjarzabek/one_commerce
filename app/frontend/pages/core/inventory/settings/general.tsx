import { Head, router } from "@inertiajs/react"
import { PenLineIcon, RadioIcon, StoreIcon, type LucideIcon } from "lucide-react"

import { OptionSelect } from "@/components/option-select"
import { PageBar } from "@/components/page-bar"
import { InventorySettingsTabs } from "@/components/inventory/inventory-tabs"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type SourceKey = "live" | "ecommerce" | "manual"

type Props = {
  warehouses: { id: number; name: string }[]
  sources: Record<SourceKey, { enabled: boolean; warehouse_id: number }>
}

const SOURCES: { key: SourceKey; label: string; description: string; icon: LucideIcon }[] = [
  { key: "live", label: "Live", description: "Zamówienia z transmisji (koszyki z komentarzy).", icon: RadioIcon },
  { key: "ecommerce", label: "E-commerce", description: "Marketplace'y i sklepy internetowe (MultiChannel).", icon: StoreIcon },
  { key: "manual", label: "Ręczne", description: "Zamówienia dodane w panelu i przez API.", icon: PenLineIcon },
]

// Ustawienia › Ogólne: magazyn i rezerwacje dla źródeł zamówień.
export default function InventorySettingsGeneral({ warehouses, sources }: Props) {
  const updateSource = (source: SourceKey, changes: { enabled?: boolean; warehouse_id?: number }) =>
    router.patch("/inventory/settings/sources", { source, ...changes }, { preserveScroll: true })

  return (
    <>
      <Head title="Ustawienia ogólne" />
      <PageBar breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Ustawienia", href: "/inventory/settings" }, { label: "Ogólne" }]} />
      <InventorySettingsTabs />

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Źródła zamówień</CardTitle>
          <CardDescription>
            Z którego magazynu schodzi towar zamówień z danego źródła i czy zamówienie rezerwuje go od razu. Bez rezerwacji towar schodzi ze stanu
            dopiero przy wysyłce.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Źródło</TableHead>
              <TableHead>Magazyn</TableHead>
              <TableHead className="pr-6 text-right">Rezerwacja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SOURCES.map((source) => {
              const setting = sources[source.key]
              return (
                <TableRow key={source.key}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <source.icon className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium">{source.label}</div>
                        <div className="text-muted-foreground text-xs">{source.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OptionSelect
                      className="w-56"
                      options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                      value={String(setting.warehouse_id)}
                      onChange={(value) => updateSource(source.key, { warehouse_id: Number(value) })}
                    />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Switch
                      aria-label={`Rezerwacja – ${source.label}`}
                      checked={setting.enabled}
                      onCheckedChange={(enabled) => updateSource(source.key, { enabled })}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
