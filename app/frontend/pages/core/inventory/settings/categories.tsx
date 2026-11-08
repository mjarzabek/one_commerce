import { Head } from "@inertiajs/react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import { InventorySettingsTabs } from "@/components/inventory/inventory-tabs"
import { NameDialog } from "@/components/inventory/name-dialog"
import { errorText, productsWord, type CatalogOption, type FormErrors } from "@/components/inventory/types"
import { OptionCombobox } from "@/components/option-combobox"
import { OptionSelect } from "@/components/option-select"
import { PageBar } from "@/components/page-bar"
import { RowActions } from "@/components/row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Category = { id: number; name: string; path: string; catalog_id: number | null; parent_id: number | null; source: string; products: number }

type Props = { categories: Category[]; catalogs: CatalogOption[] }

type DialogForm = {
  data: Record<string, string | string[] | boolean>
  setData: (key: string, value: string | string[] | boolean) => void
  errors: FormErrors
}

// Wartość „Ogólna” w selekcie katalogu (Base UI Select nie przyjmuje pustej wartości) - wysyłana jako "".
const GENERAL = "general"

// Czy `category` może być nadrzędną kategorii `self` w katalogu `catalogId` ("" = ogólna): ogólna albo z tego samego
// katalogu, nie sama kategoria ani jej podkategoria.
const parentAllowed = (category: Category, catalogId: string, self: Category | undefined, byId: Map<number, Category>) => {
  if (category.catalog_id !== null && String(category.catalog_id) !== catalogId) return false
  if (!self) return true
  for (let node: Category | undefined = category; node; node = node.parent_id ? byId.get(node.parent_id) : undefined) {
    if (node.id === self.id) return false
  }
  return true
}

export default function InventorySettingsCategories({ categories, catalogs }: Props) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const catalogName = (id: number | null) => (id === null ? null : (catalogs.find((c) => c.id === id)?.name ?? "?"))
  const depth = (category: Category) => category.path.split(" › ").length - 1

  // Pola okna kategorii: katalog (albo ogólna) i kategoria nadrzędna.
  const categoryFields =
    (self?: Category) =>
    ({ data, setData, errors }: DialogForm) => {
      const catalogId = String(data.catalog_id ?? "")
      const parentOptions = categories.filter((category) => parentAllowed(category, catalogId, self, byId))
      return (
        <>
          <Field data-invalid={!!errorText(errors, "catalog_id") || !!errorText(errors, "catalog")}>
            <FieldLabel htmlFor="category-catalog">Katalog</FieldLabel>
            <OptionSelect
              id="category-catalog"
              options={[{ value: GENERAL, label: "Brak - kategoria ogólna" }, ...catalogs.map((c) => ({ value: String(c.id), label: c.name }))]}
              value={catalogId || GENERAL}
              onChange={(value) => {
                const next = value === GENERAL ? "" : value
                setData("catalog_id", next)
                const parent = byId.get(Number(data.parent_id))
                if (parent && !parentAllowed(parent, next, self, byId)) setData("parent_id", "")
              }}
            />
            <FieldError>{errorText(errors, "catalog_id") ?? errorText(errors, "catalog")}</FieldError>
          </Field>
          <Field data-invalid={!!errorText(errors, "parent_id")}>
            <FieldLabel htmlFor="category-parent">Kategoria nadrzędna</FieldLabel>
            <OptionCombobox
              id="category-parent"
              label="Kategoria nadrzędna"
              options={[{ value: "", label: "Brak - kategoria główna" }, ...parentOptions.map((c) => ({ value: String(c.id), label: c.path }))]}
              value={String(data.parent_id ?? "")}
              onChange={(value) => setData("parent_id", value)}
              invalid={!!errorText(errors, "parent_id")}
            />
            <FieldError>{errorText(errors, "parent_id")}</FieldError>
          </Field>
        </>
      )
    }

  return (
    <>
      <Head title="Kategorie" />
      <PageBar
        breadcrumbs={[{ label: "Produkty", href: "/inventory" }, { label: "Ustawienia", href: "/inventory/settings" }, { label: "Kategorie" }]}
        actions={
          <NameDialog
            title="Nowa kategoria"
            action="/inventory/settings/categories"
            initial={{ name: "", catalog_id: "", parent_id: "" }}
            submitLabel="Dodaj kategorię"
            trigger={
              <Button>
                <PlusIcon />
                Dodaj kategorię
              </Button>
            }
          >
            {categoryFields()}
          </NameDialog>
        }
      />
      <Card className="gap-0 py-0">
        <InventorySettingsTabs className="mt-0 px-2" />
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Katalog</TableHead>
              <TableHead>Źródło</TableHead>
              <TableHead className="text-right">Produkty</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  Brak kategorii.
                </TableCell>
              </TableRow>
            )}
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="pl-4 font-medium">
                  <span style={{ paddingLeft: `${depth(category) * 1.25}rem` }}>
                    {depth(category) > 0 && <span className="text-muted-foreground mr-1.5">└</span>}
                    {category.name}
                  </span>
                </TableCell>
                <TableCell>{catalogName(category.catalog_id) ?? <span className="text-muted-foreground">Ogólna</span>}</TableCell>
                <TableCell>
                  <Badge variant="outline">{category.source}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{category.products}</TableCell>
                <TableCell className="pr-4 text-right">
                  <CategoryActions category={category} hasChildren={categories.some((c) => c.parent_id === category.id)} fields={categoryFields(category)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

// Akcje wiersza kategorii (⋯): edycja i usunięcie (niedostępne, gdy kategoria ma podkategorie).
function CategoryActions({ category, hasChildren, fields }: { category: Category; hasChildren: boolean; fields: (form: DialogForm) => React.ReactNode }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)

  return (
    <>
      <RowActions
        actions={[
          { label: "Edytuj", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Usuń", icon: Trash2Icon, destructive: true, disabled: hasChildren, onSelect: () => setDialog("delete") },
        ]}
      />
      <NameDialog
        open={dialog === "edit"}
        onOpenChange={close}
        title={`Kategoria „${category.name}”`}
        action={`/inventory/settings/categories/${category.id}`}
        method="patch"
        initial={{ name: category.name, catalog_id: category.catalog_id ? String(category.catalog_id) : "", parent_id: category.parent_id ? String(category.parent_id) : "" }}
      >
        {fields}
      </NameDialog>
      <ConfirmDelete
        open={dialog === "delete"}
        onOpenChange={close}
        title={`Usunąć kategorię „${category.name}”?`}
        description={
          category.products > 0 ? `${category.products} ${productsWord(category.products)} zostanie bez kategorii.` : "Żaden produkt nie ma tej kategorii."
        }
        url={`/inventory/settings/categories/${category.id}`}
      />
    </>
  )
}
