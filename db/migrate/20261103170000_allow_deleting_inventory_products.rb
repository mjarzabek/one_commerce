# Produkt można usunąć zawsze: jego stany, ruchy i rezerwacje znikają razem z nim, a pozycje zamówień zostają
# (mają własną nazwę, SKU i cenę) - tylko bez powiązania z produktem. Status „Zarchiwizowany” znika - takie produkty
# wracają jako szkice.
class AllowDeletingInventoryProducts < ActiveRecord::Migration[8.1]
  CASCADE = %i[inventory_stock_items inventory_movements inventory_reservations].freeze

  def up
    CASCADE.each do |table|
      remove_foreign_key table, :inventory_products, column: :product_id
      add_foreign_key table, :inventory_products, column: :product_id, on_delete: :cascade
    end
    remove_foreign_key :orders_items, :inventory_products, column: :product_id
    add_foreign_key :orders_items, :inventory_products, column: :product_id, on_delete: :nullify

    execute "UPDATE inventory_products SET status = 'draft' WHERE status = 'archived'"
  end

  def down
    (CASCADE + %i[orders_items]).each do |table|
      remove_foreign_key table, :inventory_products, column: :product_id
      add_foreign_key table, :inventory_products, column: :product_id
    end
  end
end
