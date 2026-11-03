import type { Crumb } from "@/components/page-bar"

export type CatalogOption = { id: number; name: string }

export type PriceGroup = { id: number; name: string; currency: string; default: boolean }

export type PriceInputs = Record<string, string | null>

// Pola „Na stanie” formularza karty: { warehouse_id: "5" } (tylko magazyny bez ścisłej kontroli).
export type StockInputs = Record<string, string>

export type StockWarehouse = { id: number; name: string; on_hand: number; reserved: number; strict_control: boolean }

export type ProductStock = { warehouses: StockWarehouse[] }

// Historia i rezerwacje produktu albo wszystkich wariantów (wtedy `product` = nazwa wariantu).
export type ProductActivity = {
  movements: {
    id: number
    product: string | null
    quantity: number
    before: number
    after: number
    reason: string
    warehouse: string
    description: string | null
    user: string | null
    created_at: string
  }[]
  priceChanges: {
    id: number
    product: string | null
    priceGroup: string
    // Przy ustawieniu ceny (direction "set") nie ma poprzedniej ceny.
    before: string | null
    after: string
    direction: "set" | "up" | "down"
    user: string | null
    created_at: string
  }[]
  reservations: { id: number; product: string | null; quantity: number; warehouse: string; holder: string; created_at: string }[]
  limit: number
}

export type ProductImage = { id: number; url: string; name: string }

export type FormErrors = Record<string, string[] | string | undefined>

export const errorText = (errors: FormErrors, key: string) => {
  const value = errors[key]
  return Array.isArray(value) ? value.join(" ") : value
}

export const variantsWord = (count: number) =>
  count === 1 ? "wariant" : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "warianty" : "wariantów"

export const formatDate = (iso: string) => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })

// Stan z pól formularza: { warehouse_id: "na stanie" } dla magazynów bez ścisłej kontroli.
export const stockInputs = (stock: ProductStock | undefined): StockInputs =>
  Object.fromEntries((stock?.warehouses ?? []).filter((w) => !w.strict_control).map((w) => [String(w.id), String(w.on_hand)]))

// Początek okruszków ekranów produktu: „Produkty” (link wraca do listy w katalogu produktu). Katalogu nie pokazujemy.
export const catalogCrumbs = (catalog: CatalogOption): Crumb[] => [{ label: "Produkty", href: `/inventory?catalog_id=${catalog.id}` }]
