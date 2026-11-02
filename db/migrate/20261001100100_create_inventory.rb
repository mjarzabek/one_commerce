# Magazyn: magazyny, katalogi (z wybranymi magazynami), produkty (proste i wariantowe), grupy cenowe, stany, rezerwacje i ruchy.
#
# Produkt prosty to wiersz bez rodzica i bez wariantów. Produkt wariantowy to produkt główny (parent_id = NULL)
# i jego warianty (parent_id = id produktu głównego). Ceny i stany mają produkty proste i warianty.
class CreateInventory < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_catalogs do |t|
      t.references :account, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :inventory_catalogs, %i[account_id name], unique: true

    # Magazyny konta – fizyczne miejsca składowania. Kolejność (position) to priorytet wydawania towaru.
    create_table :inventory_warehouses do |t|
      t.references :account, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :inventory_warehouses, %i[account_id name], unique: true

    # Magazyny, z których korzysta katalog (wybierane w katalogu). Stan łączny = suma tych magazynów.
    create_table :inventory_catalog_warehouses do |t|
      t.references :catalog, null: false, foreign_key: { to_table: :inventory_catalogs, on_delete: :cascade }, index: false
      t.references :warehouse, null: false, foreign_key: { to_table: :inventory_warehouses }
    end
    add_index :inventory_catalog_warehouses, %i[catalog_id warehouse_id], unique: true

    create_table :inventory_price_groups do |t|
      t.references :account, null: false, foreign_key: true
      t.string :name, null: false
      t.string :currency, null: false, default: "PLN"
      t.boolean :default, null: false, default: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :inventory_price_groups, %i[account_id name], unique: true
    add_index :inventory_price_groups, :account_id, unique: true, where: '"default"', name: "index_inventory_price_groups_one_default"

    create_table :inventory_products do |t|
      t.references :account, null: false, foreign_key: true
      t.references :catalog, null: false, foreign_key: { to_table: :inventory_catalogs }, index: false
      t.references :parent, foreign_key: { to_table: :inventory_products }
      t.string :name, null: false
      t.string :sku
      t.string :ean
      t.text :description
      t.string :status, null: false, default: "active"
      t.decimal :tax_rate, precision: 5, scale: 2, null: false, default: 23
      t.integer :weight_grams
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :inventory_products, %i[catalog_id sku], unique: true, where: "sku IS NOT NULL"
    add_index :inventory_products, %i[catalog_id parent_id]
    add_index :inventory_products, %i[account_id ean]

    create_table :inventory_prices do |t|
      t.references :account, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: { to_table: :inventory_products, on_delete: :cascade }, index: false
      t.references :price_group, null: false, foreign_key: { to_table: :inventory_price_groups, on_delete: :cascade }
      t.integer :amount_cents, null: false
      t.timestamps
    end
    add_index :inventory_prices, %i[product_id price_group_id], unique: true
    add_check_constraint :inventory_prices, "amount_cents >= 0", name: "inventory_prices_amount_non_negative"

    create_table :inventory_stock_items do |t|
      t.references :account, null: false, foreign_key: true
      t.references :warehouse, null: false, foreign_key: { to_table: :inventory_warehouses }, index: false
      t.references :product, null: false, foreign_key: { to_table: :inventory_products }
      t.integer :on_hand, null: false, default: 0
      t.integer :reserved, null: false, default: 0
      t.timestamps
    end
    add_index :inventory_stock_items, %i[warehouse_id product_id], unique: true
    add_check_constraint :inventory_stock_items, "reserved >= 0 AND reserved <= on_hand", name: "inventory_stock_items_reserved_in_range"

    create_table :inventory_reservations do |t|
      t.references :account, null: false, foreign_key: true
      t.references :warehouse, null: false, foreign_key: { to_table: :inventory_warehouses }
      t.references :product, null: false, foreign_key: { to_table: :inventory_products }
      t.integer :quantity, null: false
      t.string :holder_type, null: false
      t.bigint :holder_id, null: false
      t.string :status, null: false, default: "active"
      t.datetime :expires_at
      t.timestamps
    end
    add_index :inventory_reservations, %i[holder_type holder_id]
    add_check_constraint :inventory_reservations, "quantity > 0", name: "inventory_reservations_quantity_positive"

    create_table :inventory_movements do |t|
      t.references :account, null: false, foreign_key: true
      t.references :warehouse, null: false, foreign_key: { to_table: :inventory_warehouses }
      t.references :product, null: false, foreign_key: { to_table: :inventory_products }
      t.integer :quantity, null: false
      t.string :reason, null: false
      t.string :reference
      t.string :holder_type
      t.bigint :holder_id
      t.references :user, foreign_key: true
      t.timestamps
    end
    add_index :inventory_movements, %i[holder_type holder_id]

    # Czy zamówienia z danego źródła (live / ecommerce / manual) rezerwują towar.
    create_table :inventory_reservation_policies do |t|
      t.references :account, null: false, foreign_key: true, index: false
      t.string :source, null: false
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_index :inventory_reservation_policies, %i[account_id source], unique: true
  end
end
