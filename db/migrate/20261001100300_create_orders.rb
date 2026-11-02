class CreateOrders < ActiveRecord::Migration[8.1]
  def change
    create_table :orders_orders do |t|
      t.references :account, null: false, foreign_key: true
      t.string :number, null: false
      t.string :source, null: false
      t.string :source_channel
      t.string :external_id
      t.references :customer, foreign_key: { to_table: :customers_customers }
      t.string :customer_name
      t.string :customer_email
      t.string :customer_phone
      t.string :status, null: false, default: "new"
      t.string :payment_status, null: false, default: "unpaid"
      t.string :currency, null: false, default: "PLN"
      t.references :price_group, foreign_key: { to_table: :inventory_price_groups, on_delete: :nullify }
      t.boolean :stock_reserved, null: false, default: false
      t.integer :subtotal_cents, null: false, default: 0
      t.integer :shipping_cents, null: false, default: 0
      t.integer :total_cents, null: false, default: 0
      t.jsonb :billing_address, null: false, default: {}
      t.jsonb :shipping_address, null: false, default: {}
      t.string :shipping_method
      t.text :notes
      t.datetime :placed_at, null: false
      t.timestamps
    end
    add_index :orders_orders, %i[account_id number], unique: true
    add_index :orders_orders, %i[account_id source external_id], unique: true, where: "external_id IS NOT NULL"
    add_index :orders_orders, %i[account_id status]

    create_table :orders_items do |t|
      t.references :account, null: false, foreign_key: true
      t.references :order, null: false, foreign_key: { to_table: :orders_orders }
      t.references :product, foreign_key: { to_table: :inventory_products }
      t.string :sku
      t.string :name, null: false
      t.integer :quantity, null: false
      t.integer :unit_price_cents, null: false
      t.decimal :tax_rate, precision: 5, scale: 2, null: false, default: 23
      t.integer :total_cents, null: false
      t.timestamps
    end
    add_check_constraint :orders_items, "quantity > 0", name: "orders_items_quantity_positive"

    create_table :orders_status_changes do |t|
      t.references :account, null: false, foreign_key: true
      t.references :order, null: false, foreign_key: { to_table: :orders_orders }
      t.string :from_status
      t.string :to_status, null: false
      t.references :user, foreign_key: true
      t.text :note
      t.datetime :created_at, null: false
    end

    create_table :orders_number_sequences do |t|
      t.references :account, null: false, foreign_key: true, index: false
      t.integer :year, null: false
      t.integer :last_value, null: false, default: 0
    end
    add_index :orders_number_sequences, %i[account_id year], unique: true
  end
end
