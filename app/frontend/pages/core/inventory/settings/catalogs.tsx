import { Head, Link } from "@inertiajs/react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { NameDialog } from "@/components/inventory/name-dialog"
import { errorText, type CatalogOption, type FormErrors } from "@/components/inventory/types"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
  catalogs: { id: number; name: string; products: number; warehouse_ids: number[]; price_group_ids: number[] }[]
  warehouses: CatalogOption[]
  priceGroups: (CatalogOption & { currency: string })[]
}

type DialogForm = {
  data: Record<string, string | string[] | boolean>
  setData: (key: string, value: string | string[] | boolean) => void
  errors: FormErrors
}

// Akcje wiersza katalogu (⋯): edycja nazwy, magazynów i grup cenowych oraz usunięcie.
function CatalogActions({
  catalog,
  canDelete,
  fields,
}: {
  catalog: Props["catalogs"][number]
  canDelete: boolean
  fields: (form: DialogForm) => React.ReactNode
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <RowActions
        actions={[
          { label: "Edytuj", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Usuń", icon: Trash2Icon, destructive: true, disabled: !canDelete, onSelect: () => setDialog("delete") },
        ]}
      />
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={close}
        title={`Katalog „${catalog.name}”`}
        action={`/inventory/catalogs/${catalog.id}`}
        method="patch"
        initial={{ name: catalog.name, warehouse_ids: catalog.warehouse_ids.map(String), price_group_ids: catalog.price_group_ids.map(String) }}
      >
        {fields}
      </NameDialog>
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć katalog „${catalog.name}”?`}
        description="Magazyny i grupy cenowe zostają – usuwany jest tylko katalog. Katalog z produktami nie może zostać usunięty."
        url={`/inventory/catalogs/${catalog.id}`}
      />
    </>
  )
}

export default function InventoryCatalogs({ catalogs, warehouses, priceGroups }: Props) {
  const warehouseName = (id: number) => warehouses.find((w) => w.id === id)?.name ?? "?"
  const priceGroupName = (id: number) => priceGroups.find((g) => g.id === id)?.name ?? "?"

  // Lista checkboxów (magazyny, grupy cenowe) w oknie katalogu.
  const checkboxField = (
    { data, setData, errors }: DialogForm,
    param: string,
    label: string,
    description: string,
    options: { id: number; name: string }[],
  ) => {
    const selected = (data[param] as string[]) ?? []
    return (
      <Field data-invalid={!!errorText(errors, param)}>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const id = String(option.id)
            return (
              <Label key={option.id} className="font-normal">
                <Checkbox
                  checked={selected.includes(id)}
                  onCheckedChange={(checked) => setData(param, checked ? [...selected, id] : selected.filter((v) => v !== id))}
                />
                {option.name}
              </Label>
            )
          })}
        </div>
        <FieldError>{errorText(errors, param)}</FieldError>
      </Field>
    )
  }

  const catalogFields = (form: DialogForm) => (
    <>
      {checkboxField(form, "warehouse_ids", "Magazyny", "Stan produktów z katalogu to suma zaznaczonych magazynów.", warehouses)}
      {checkboxField(
        form,
        "price_group_ids",
        "Grupy cenowe",
        "Produkty z katalogu mają ceny w zaznaczonych grupach. Odznaczenie grupy ukrywa ceny, nie kasuje ich.",
        priceGroups.map((g) => ({ id: g.id, name: `${g.name} (${g.currency})` })),
      )}
    </>
  )

  return (
    <>
      <Head title="Katalogi" />
      <PageBar
        breadcrumbs={[{ label: "Magazyn", href: "/inventory" }, { label: "Katalogi" }]}
        actions={
          <NameDialog
            title="Nowy katalog"
            action="/inventory/catalogs"
            initial={{ name: "", warehouse_ids: warehouses.slice(0, 1).map((w) => String(w.id)), price_group_ids: priceGroups.slice(0, 1).map((g) => String(g.id)) }}
            submitLabel="Dodaj katalog"
            trigger={
              <Button size="sm">
                <PlusIcon />
                Dodaj katalog
              </Button>
            }
          >
            {catalogFields}
          </NameDialog>
        }
      />
      <InventoryTabs />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Magazyny</TableHead>
              <TableHead>Grupy cenowe</TableHead>
              <TableHead className="text-right">Produkty</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogs.map((catalog) => (
              <TableRow key={catalog.id}>
                <TableCell className="pl-4 font-medium">
                  <Link href={`/inventory?catalog_id=${catalog.id}`}>{catalog.name}</Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {catalog.warehouse_ids.map((id) => (
                      <Badge key={id} variant="outline">
                        {warehouseName(id)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {catalog.price_group_ids.map((id) => (
                      <Badge key={id} variant="outline">
                        {priceGroupName(id)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{catalog.products}</TableCell>
                <TableCell className="pr-4 text-right">
                  <CatalogActions catalog={catalog} canDelete={catalog.products === 0 && catalogs.length > 1} fields={catalogFields} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
