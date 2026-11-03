import { Head, Link, router } from "@inertiajs/react"
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventorySettingsTabs } from "@/components/inventory/inventory-tabs"
import { NameDialog } from "@/components/inventory/name-dialog"
import { OptionSelect } from "@/components/option-select"
import { DefaultStar } from "@/components/default-star"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Props = {
  priceGroups: { id: number; name: string; currency: string; default: boolean; priced: number; catalogs: { id: number; name: string }[] }[]
  sellable: number
  currencies: string[]
}

type Group = Props["priceGroups"][number]
type CurrencyField = (form: { data: Record<string, unknown>; setData: (key: string, value: string) => void }) => React.ReactNode

// Akcje wiersza grupy cenowej (⋯): ustawienie jako domyślnej, edycja i usunięcie.
function PriceGroupActions({ group, currencyField }: { group: Group; currencyField: CurrencyField }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <RowActions
        actions={[
          {
            label: "Ustaw jako domyślną",
            icon: StarIcon,
            hidden: group.default,
            onSelect: () => router.patch(`/inventory/settings/prices/${group.id}`, { default: true }, { preserveScroll: true }),
          },
          { label: "Edytuj", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Usuń", icon: Trash2Icon, destructive: true, disabled: group.default, onSelect: () => setDialog("delete") },
        ]}
      />
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={close}
        title="Edytuj grupę cenową"
        action={`/inventory/settings/prices/${group.id}`}
        method="patch"
        initial={{ name: group.name, currency: group.currency }}
      >
        {currencyField}
      </NameDialog>
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć grupę „${group.name}”?`}
        description="Usuwa grupę razem ze wszystkimi cenami produktów w tej grupie."
        url={`/inventory/settings/prices/${group.id}`}
      />
    </>
  )
}

export default function InventorySettingsPrices({ priceGroups, sellable, currencies }: Props) {
  const currencyField = ({ data, setData }: { data: Record<string, unknown>; setData: (key: string, value: string) => void }) => (
    <Field>
      <FieldLabel htmlFor="currency">Waluta</FieldLabel>
      <OptionSelect
        id="currency"
        options={currencies.map((c) => ({ value: c, label: c }))}
        value={String(data.currency ?? "PLN")}
        onChange={(value) => setData("currency", value)}
      />
    </Field>
  )

  return (
    <>
      <Head title="Ceny" />
      <PageBar
        breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Ustawienia", href: "/inventory/settings" }, { label: "Ceny" }]}
        actions={
          <NameDialog
            title="Nowa grupa cenowa"
            description="Po dodaniu zaznacz ją w katalogach, które mają z niej korzystać."
            action="/inventory/settings/prices"
            initial={{ name: "", currency: "PLN" }}
            submitLabel="Dodaj grupę"
            trigger={
              <Button>
                <PlusIcon />
                Dodaj grupę cenową
              </Button>
            }
          >
            {currencyField}
          </NameDialog>
        }
      />
      {/* Zakładki w karcie razem z tabelą - jak na liście produktów. */}
      <Card className="gap-0 py-0">
        <InventorySettingsTabs className="mt-0 px-2" />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Waluta</TableHead>
              <TableHead>Katalogi</TableHead>
              <TableHead className="text-right">Produktów z ceną</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceGroups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="pl-4 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {group.default && <DefaultStar />}
                    {group.name}
                  </span>
                </TableCell>
                <TableCell>{group.currency}</TableCell>
                <TableCell>
                  {group.catalogs.length === 0 ? (
                    <span className="text-muted-foreground text-sm">
                      Nieużywana -{" "}
                      <Link href="/inventory/settings/catalogs" className="text-foreground underline underline-offset-4">
                        zaznacz w katalogu
                      </Link>
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {group.catalogs.map((catalog) => (
                        <Badge key={catalog.id} variant="outline">
                          {catalog.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {group.priced} / {sellable}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <PriceGroupActions group={group} currencyField={currencyField} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
