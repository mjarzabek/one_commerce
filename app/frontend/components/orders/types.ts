export type StatusColor = "gray" | "blue" | "sky" | "violet" | "pink" | "green" | "amber" | "orange" | "red"

export type OrderStatus = {
  id: number
  name: string
  color: StatusColor
  default?: boolean
  status_group_id?: number | null
  count?: number
}

export type StatusGroup = { id: number; name: string; statuses: OrderStatus[] }

// Grupy ze statusami (kolejność z ustawień) i statusy bez grupy.
export type StatusTree = { groups: StatusGroup[]; ungrouped: OrderStatus[] }

// Płatność: kwota wpłacona względem wartości zamówienia (sformatowane kwoty i wartości do pól formularza).
// `cod` - za pobraniem i nic jeszcze nie wpłacono.
export type Payment = {
  status: "unpaid" | "partial" | "paid" | "overpaid"
  method: string | null
  cod: boolean
  label: string
  methodLabel: string | null
  paid: string
  total: string
  remaining: string
  overpaid: string
  paidInput: string
  totalInput: string
}

export const PAYMENT_METHODS = [
  { value: "transfer", label: "Przelew" },
  { value: "online", label: "Płatność online" },
  { value: "cod", label: "Za pobraniem" },
  { value: "cash", label: "Gotówka" },
]

export type Address = {
  name?: string
  company?: string
  nip?: string
  code?: string
  street?: string
  postal_code?: string
  city?: string
  country?: string
  phone?: string
}

export type Customer = {
  name: string | null
  email: string | null
  phone: string | null
}

export const ordersWord = ["zamówienie", "zamówienia", "zamówień"] as const

export type CustomFieldKind = "text" | "number" | "select" | "date" | "boolean"

export type CustomFieldDefinition = { id: number; name: string; kind: CustomFieldKind; options: string[] }
