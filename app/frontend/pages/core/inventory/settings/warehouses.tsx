import { Head, Link, router } from "@inertiajs/react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventorySettingsTabs } from "@/components/inventory/inventory-tabs"
import { NameDialog } from "@/components/inventory/name-dialog"
import type { CatalogOption } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
  warehouses: { id: number; name: string; units: number; strict_control: boolean; catalogs: CatalogOption[] }[]
}

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
        action={`/inventory/settings/warehouses/${warehouse.id}`}
        method="patch"
        initial={{ name: warehouse.name }}
      />
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć magazyn „${warehouse.name}”?`}
        description="Można usunąć tylko pusty magazyn bez historii ruchów, który nie jest jedynym magazynem żadnego katalogu ani magazynem źródła zamówień (Ustawienia › Ogólne)."
        url={`/inventory/settings/warehouses/${warehouse.id}`}
      />
    </>
  )
}

export default function InventorySettingsWarehouses({ warehouses }: Props) {
  return (
    <>
      <Head title="Magazyny" />
      <PageBar
        breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Ustawienia", href: "/inventory/settings" }, { label: "Magazyny" }]}
        actions={
          <NameDialog
            title="Nowy magazyn"
            description="Po dodaniu zaznacz go w katalogach, które mają z niego korzystać."
            action="/inventory/settings/warehouses"
            initial={{ name: "" }}
            submitLabel="Dodaj magazyn"
            trigger={
              <Button>
                <PlusIcon />
                Dodaj magazyn
              </Button>
            }
          />
        }
      />
      {/* Zakładki w karcie razem z tabelą - jak na liście produktów. */}
      <Card className="gap-0 py-0">
        <InventorySettingsTabs className="mt-0 px-2" />
        <CardHeader className="py-4">
          <CardTitle>Magazyny</CardTitle>
          <CardDescription>
            Bez ścisłej kontroli stan to zwykłe pole na karcie produktu - zmieniasz je ręcznie, a historia zapisuje, z ilu na ile. Ze ścisłą
            kontrolą stan w magazynie zmieniają tylko dokumenty magazynowe (wkrótce) i zamówienia.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Katalogi</TableHead>
              <TableHead className="text-right">Sztuk na stanie</TableHead>
              <TableHead className="text-right">Ścisła kontrola</TableHead>
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
                      Nieużywany -{" "}
                      <Link href="/inventory/settings/catalogs" className="text-foreground underline underline-offset-4">
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
                <TableCell className="text-right">
                  <Switch
                    aria-label={`Ścisła kontrola - ${warehouse.name}`}
                    checked={warehouse.strict_control}
                    onCheckedChange={(strict_control) =>
                      router.patch(`/inventory/settings/warehouses/${warehouse.id}`, { strict_control }, { preserveScroll: true })
                    }
                  />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <WarehouseActions warehouse={warehouse} canDelete={warehouses.length > 1} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
