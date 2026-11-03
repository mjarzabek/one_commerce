module Inventory
  # Migawka produktu sprzedawalnego (produkt prosty albo wariant) dla innych pakietów.
  # `name` to pełna nazwa do wyświetlenia („Sukienka Lena - M”), cena pochodzi z wybranej grupy cenowej
  # (nil, gdy produkt nie ma w niej ceny).
  ProductInfo = Data.define(:id, :parent_id, :catalog_id, :sku, :ean, :name, :tax_rate,
    :price_group_id, :price_cents, :currency)
end
