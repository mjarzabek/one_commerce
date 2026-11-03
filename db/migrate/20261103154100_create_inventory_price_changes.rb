# Historia cen: każda zmiana ceny produktu w grupie cenowej (z ilu na ile, kto). Pusta kwota = brak ceny w grupie.
class CreateInventoryPriceChanges < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_price_changes do |t|
      t.references :account, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: { to_table: :inventory_products, on_delete: :cascade }
      t.references :price_group, null: false, foreign_key: { to_table: :inventory_price_groups, on_delete: :cascade }
      t.integer :amount_cents_before
      t.integer :amount_cents_after
      t.references :user, foreign_key: { on_delete: :nullify }
      t.datetime :created_at, null: false
    end
  end
end
