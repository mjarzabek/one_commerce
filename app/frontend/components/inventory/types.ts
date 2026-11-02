import type { Crumb } from "@/components/page-bar"

export type CatalogOption = { id: number; name: string }

export type PriceGroup = { id: number; name: string; currency: string; default: boolean }

export type PriceInputs = Record<string, string | null>

export type StockWarehouse = { id: number; name: string; on_hand: number; reserved: number }

export type ProductStock = {
  warehouses: StockWarehouse[]
  reservations: { id: number; quantity: number; warehouse: string; holder: string; created_at: string }[]
  movements: {
    id: number
    quantity: number
    before: number
    after: number
    reason: string
    warehouse: string
    description: string | null
    user: string | null
    created_at: string
  }[]
}


export type FormErrors = Record<string, string[] | string | undefined>

export const errorText = (errors: FormErrors, key: string) => {
  const value = errors[key]
  return Array.isArray(value) ? value.join(" ") : value
}

// Początek okruszków ekranów produktu: „Produkty” (link wraca do listy w katalogu produktu). Katalogu nie pokazujemy.
export const catalogCrumbs = (catalog: CatalogOption): Crumb[] => [{ label: "Produkty", href: `/inventory?catalog_id=${catalog.id}` }]
