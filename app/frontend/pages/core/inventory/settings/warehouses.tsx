import { Head, Link, router } from "@inertiajs/react"
import { PencilIcon, PenLineIcon, PlusIcon, RadioIcon, StoreIcon, Trash2Icon, type LucideIcon } from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { NameDialog } from "@/components/inventory/name-dialog"
import { OptionSelect } from "@/components/inventory/option-select"
import type { CatalogOption } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type SourceKey = "live" | "ecommerce" | "manual"

type Props = {
  warehouses: { id: number; name: string; units: number; catalogs: CatalogOption[] }[]
  sources: Record<SourceKey, { enabled: boolean; warehouse_id: number }>
}

const SOURCES: { key: SourceKey; label: string; description: string; icon: LucideIcon }[] = [
  { key: "live", label: "Live", description: "Zamówienia z transmisji (koszyki z komentarzy).", icon: RadioIcon },
  { key: "ecommerce", label: "E-commerce", description: "Marketplace'y i sklepy internetowe (MultiChannel).", icon: StoreIcon },
  { key: "manual", label: "Ręczne", description: "Zamówienia dodane w panelu i przez API.", icon: PenLineIcon },
]

// Akcje wiersza magazynu (⋯): zmiana nazwy i usunięcie.
function WarehouseActions({ warehouse, canDelete }: { warehouse: Props["warehouses"][number]; canDelete: boolean }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <RowActions
        actions={[
          { label: "Zmień nazwę", icon: PencilIcon, onSelect: () => setDialog("rename") },
          { label: "Usuń", icon: Trash2Icon, destructive: true, disabled: !canDelete, onSelect: () => setDialog("delete") },
        ]}
      />
      <NameDialog
        open={dialog === "rename"}
        onOpenChange={close}
        title="Zmień nazwę magazynu"
        action={`/inventory/warehouses/${warehouse.id}`}
        method="patch"
        initial={{ name: warehouse.name }}
      />
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć magazyn „${warehouse.name}”?`}
        description="Można usunąć tylko pusty magazyn bez historii ruchów, który nie jest jedynym magazynem żadnego katalogu ani magazynem źródła zamówień."
        url={`/inventory/warehouses/${warehouse.id}`}
      />
    </>
  )
}

export default function InventoryWarehouses({ warehouses, sources }: Props) {
  const updateSource = (source: SourceKey, changes: { enabled?: boolean; warehouse_id?: number }) =>
    router.patch("/inventory/sources", { source, ...changes }, { preserveScroll: true })

  return (
    <>
      <Head title="Magazyny" />
      <PageBar
        breadcrumbs={[{ label: "Magazyn", href: "/inventory" }, { label: "Magazyny" }]}
        actions={
          <NameDialog
            title="Nowy magazyn"
            description="Po dodaniu zaznacz go w katalogach, które mają z niego korzystać."
            action="/inventory/warehouses"
            initial={{ name: "" }}
            submitLabel="Dodaj magazyn"
            trigger={
              <Button size="sm">
                <PlusIcon />
                Dodaj magazyn
              </Button>
            }
          />
        }
      />
      <InventoryTabs />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Katalogi</TableHead>
              <TableHead className="text-right">Sztuk na stanie</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell className="pl-4 font-medium">{warehouse.name}</TableCell>
                <TableCell>
                  {warehouse.catalogs.length === 0 ? (
                    <span className="text-muted-foreground text-sm">
                      Nieużywany –{" "}
                      <Link href="/inventory/catalogs" className="text-foreground underline underline-offset-4">
                        zaznacz w katalogu
                      </Link>
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {warehouse.catalogs.map((catalog) => (
                        <Badge key={catalog.id} variant="outline">
                          {catalog.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{warehouse.units}</TableCell>
                <TableCell className="pr-4 text-right">
                  <WarehouseActions warehouse={warehouse} canDelete={warehouses.length > 1} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
