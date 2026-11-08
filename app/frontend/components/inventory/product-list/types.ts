// `stock` - dostępne sztuki, `reserved` - rezerwacje (w magazynach kolumny „Stan”).
// `sellable` - produkt prosty albo wariant: cenę i stan można zmienić z listy.
export type Row = {
  id: number
  name: string
  sku: string | null
  ean: string | null
  price: string | null
  priceInput: string | null
  stock: number
  reserved: number
  sellable: boolean
}

// `image` - miniatura pierwszego zdjęcia (null - brak zdjęć).
export type ProductRow = Row & { status: string; image: string | null; variants: Row[] }

// Wiersz tabeli: produkt albo (jako wiersz podrzędny) jego wariant - pola produktu są wtedy puste.
export type ListRow = Row & Partial<Pick<ProductRow, "status" | "image" | "variants">>

export type Warehouse = { id: number; name: string; strict_control: boolean }
