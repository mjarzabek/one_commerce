# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_03_110000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "accounts", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "api_tokens", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "name", null: false
    t.string "token_digest", null: false
    t.string "token_hint"
    t.string "scopes", default: [], null: false, array: true
    t.datetime "last_used_at"
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_api_tokens_on_account_id"
    t.index ["token_digest"], name: "index_api_tokens_on_token_digest", unique: true
  end

  create_table "customers_customers", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "name"
    t.string "email"
    t.string "phone"
    t.jsonb "default_address", default: {}, null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "email"], name: "index_customers_customers_on_account_id_and_email"
    t.index ["account_id"], name: "index_customers_customers_on_account_id"
  end

  create_table "customers_identities", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "customer_id", null: false
    t.string "channel", null: false
    t.string "external_id", null: false
    t.string "handle"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "channel", "external_id"], name: "idx_on_account_id_channel_external_id_456a6b95ce", unique: true
    t.index ["account_id"], name: "index_customers_identities_on_account_id"
    t.index ["customer_id"], name: "index_customers_identities_on_customer_id"
  end

  create_table "inventory_catalog_price_groups", force: :cascade do |t|
    t.bigint "catalog_id", null: false
    t.bigint "price_group_id", null: false
    t.index ["catalog_id", "price_group_id"], name: "idx_on_catalog_id_price_group_id_d549cef6da", unique: true
    t.index ["price_group_id"], name: "index_inventory_catalog_price_groups_on_price_group_id"
  end

  create_table "inventory_catalog_warehouses", force: :cascade do |t|
    t.bigint "catalog_id", null: false
    t.bigint "warehouse_id", null: false
    t.index ["catalog_id", "warehouse_id"], name: "idx_on_catalog_id_warehouse_id_6c8540d0ac", unique: true
    t.index ["warehouse_id"], name: "index_inventory_catalog_warehouses_on_warehouse_id"
  end

  create_table "inventory_catalogs", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "name"], name: "index_inventory_catalogs_on_account_id_and_name", unique: true
    t.index ["account_id"], name: "index_inventory_catalogs_on_account_id"
  end

  create_table "inventory_movements", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "warehouse_id", null: false
    t.bigint "product_id", null: false
    t.integer "quantity", null: false
    t.string "reason", null: false
    t.string "reference"
    t.string "holder_type"
    t.bigint "holder_id"
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "on_hand_before", null: false
    t.integer "on_hand_after", null: false
    t.string "holder_label"
    t.index ["account_id"], name: "index_inventory_movements_on_account_id"
    t.index ["holder_type", "holder_id"], name: "index_inventory_movements_on_holder_type_and_holder_id"
    t.index ["product_id"], name: "index_inventory_movements_on_product_id"
    t.index ["user_id"], name: "index_inventory_movements_on_user_id"
    t.index ["warehouse_id"], name: "index_inventory_movements_on_warehouse_id"
  end

  create_table "inventory_price_groups", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "name", null: false
    t.string "currency", default: "PLN", null: false
    t.boolean "default", default: false, null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "name"], name: "index_inventory_price_groups_on_account_id_and_name", unique: true
    t.index ["account_id"], name: "index_inventory_price_groups_on_account_id"
    t.index ["account_id"], name: "index_inventory_price_groups_one_default", unique: true, where: "\"default\""
  end

  create_table "inventory_prices", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "product_id", null: false
    t.bigint "price_group_id", null: false
    t.integer "amount_cents", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_inventory_prices_on_account_id"
    t.index ["price_group_id"], name: "index_inventory_prices_on_price_group_id"
    t.index ["product_id", "price_group_id"], name: "index_inventory_prices_on_product_id_and_price_group_id", unique: true
    t.check_constraint "amount_cents >= 0", name: "inventory_prices_amount_non_negative"
  end

  create_table "inventory_products", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "catalog_id", null: false
    t.bigint "parent_id"
    t.string "name", null: false
    t.string "sku"
    t.string "ean"
    t.text "description"
    t.string "status", default: "active", null: false
    t.decimal "tax_rate", precision: 5, scale: 2, default: "23.0", null: false
    t.integer "weight_grams"
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "ean"], name: "index_inventory_products_on_account_id_and_ean"
    t.index ["account_id"], name: "index_inventory_products_on_account_id"
    t.index ["catalog_id", "parent_id"], name: "index_inventory_products_on_catalog_id_and_parent_id"
    t.index ["catalog_id", "sku"], name: "index_inventory_products_on_catalog_id_and_sku", unique: true, where: "(sku IS NOT NULL)"
    t.index ["parent_id"], name: "index_inventory_products_on_parent_id"
  end

  create_table "inventory_reservations", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "warehouse_id", null: false
    t.bigint "product_id", null: false
    t.integer "quantity", null: false
    t.string "holder_type", null: false
    t.bigint "holder_id", null: false
    t.string "status", default: "active", null: false
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "holder_label"
    t.index ["account_id"], name: "index_inventory_reservations_on_account_id"
    t.index ["holder_type", "holder_id"], name: "index_inventory_reservations_on_holder_type_and_holder_id"
    t.index ["product_id"], name: "index_inventory_reservations_on_product_id"
    t.index ["warehouse_id"], name: "index_inventory_reservations_on_warehouse_id"
    t.check_constraint "quantity > 0", name: "inventory_reservations_quantity_positive"
  end

  create_table "inventory_source_settings", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "source", null: false
    t.boolean "enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_id"
    t.index ["account_id", "source"], name: "index_inventory_source_settings_on_account_id_and_source", unique: true
    t.index ["warehouse_id"], name: "index_inventory_source_settings_on_warehouse_id"
  end

  create_table "inventory_stock_items", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "warehouse_id", null: false
    t.bigint "product_id", null: false
    t.integer "on_hand", default: 0, null: false
    t.integer "reserved", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_inventory_stock_items_on_account_id"
    t.index ["product_id"], name: "index_inventory_stock_items_on_product_id"
    t.index ["warehouse_id", "product_id"], name: "index_inventory_stock_items_on_warehouse_id_and_product_id", unique: true
    t.check_constraint "reserved >= 0 AND reserved <= on_hand", name: "inventory_stock_items_reserved_in_range"
  end

  create_table "inventory_warehouses", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "strict_control", default: false, null: false
    t.index ["account_id", "name"], name: "index_inventory_warehouses_on_account_id_and_name", unique: true
    t.index ["account_id"], name: "index_inventory_warehouses_on_account_id"
  end

  create_table "memberships", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "user_id", null: false
    t.string "role", default: "member", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "user_id"], name: "index_memberships_on_account_id_and_user_id", unique: true
    t.index ["account_id"], name: "index_memberships_on_account_id"
    t.index ["user_id"], name: "index_memberships_on_user_id"
  end

  create_table "module_licenses", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "module_key", null: false
    t.string "status", default: "trialing", null: false
    t.string "plan", default: "standard", null: false
    t.jsonb "limits", default: {}, null: false
    t.datetime "trial_ends_at"
    t.datetime "current_period_ends_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "module_key"], name: "index_module_licenses_on_account_id_and_module_key", unique: true
    t.index ["account_id"], name: "index_module_licenses_on_account_id"
  end

  create_table "orders_items", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "order_id", null: false
    t.bigint "product_id"
    t.string "sku"
    t.string "name", null: false
    t.integer "quantity", null: false
    t.integer "unit_price_cents", null: false
    t.decimal "tax_rate", precision: 5, scale: 2, default: "23.0", null: false
    t.integer "total_cents", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_orders_items_on_account_id"
    t.index ["order_id"], name: "index_orders_items_on_order_id"
    t.index ["product_id"], name: "index_orders_items_on_product_id"
    t.check_constraint "quantity > 0", name: "orders_items_quantity_positive"
  end

  create_table "orders_number_sequences", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.integer "year", null: false
    t.integer "last_value", default: 0, null: false
    t.index ["account_id", "year"], name: "index_orders_number_sequences_on_account_id_and_year", unique: true
  end

  create_table "orders_orders", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "number", null: false
    t.string "source", null: false
    t.string "source_channel"
    t.string "external_id"
    t.bigint "customer_id"
    t.string "customer_name"
    t.string "customer_email"
    t.string "customer_phone"
    t.string "status", default: "new", null: false
    t.string "payment_status", default: "unpaid", null: false
    t.string "currency", default: "PLN", null: false
    t.bigint "price_group_id"
    t.boolean "stock_reserved", default: false, null: false
    t.integer "subtotal_cents", default: 0, null: false
    t.integer "shipping_cents", default: 0, null: false
    t.integer "total_cents", default: 0, null: false
    t.jsonb "billing_address", default: {}, null: false
    t.jsonb "shipping_address", default: {}, null: false
    t.string "shipping_method"
    t.text "notes"
    t.datetime "placed_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_id"
    t.index ["account_id", "number"], name: "index_orders_orders_on_account_id_and_number", unique: true
    t.index ["account_id", "source", "external_id"], name: "index_orders_orders_on_account_id_and_source_and_external_id", unique: true, where: "(external_id IS NOT NULL)"
    t.index ["account_id", "status"], name: "index_orders_orders_on_account_id_and_status"
    t.index ["account_id"], name: "index_orders_orders_on_account_id"
    t.index ["customer_id"], name: "index_orders_orders_on_customer_id"
    t.index ["price_group_id"], name: "index_orders_orders_on_price_group_id"
    t.index ["warehouse_id"], name: "index_orders_orders_on_warehouse_id"
  end

  create_table "orders_status_changes", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "order_id", null: false
    t.string "from_status"
    t.string "to_status", null: false
    t.bigint "user_id"
    t.text "note"
    t.datetime "created_at", null: false
    t.index ["account_id"], name: "index_orders_status_changes_on_account_id"
    t.index ["order_id"], name: "index_orders_status_changes_on_order_id"
    t.index ["user_id"], name: "index_orders_status_changes_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "api_tokens", "accounts"
  add_foreign_key "customers_customers", "accounts"
  add_foreign_key "customers_identities", "accounts"
  add_foreign_key "customers_identities", "customers_customers", column: "customer_id"
  add_foreign_key "inventory_catalog_price_groups", "inventory_catalogs", column: "catalog_id", on_delete: :cascade
  add_foreign_key "inventory_catalog_price_groups", "inventory_price_groups", column: "price_group_id", on_delete: :cascade
  add_foreign_key "inventory_catalog_warehouses", "inventory_catalogs", column: "catalog_id", on_delete: :cascade
  add_foreign_key "inventory_catalog_warehouses", "inventory_warehouses", column: "warehouse_id"
  add_foreign_key "inventory_catalogs", "accounts"
  add_foreign_key "inventory_movements", "accounts"
  add_foreign_key "inventory_movements", "inventory_products", column: "product_id"
  add_foreign_key "inventory_movements", "inventory_warehouses", column: "warehouse_id"
  add_foreign_key "inventory_movements", "users"
  add_foreign_key "inventory_price_groups", "accounts"
  add_foreign_key "inventory_prices", "accounts"
  add_foreign_key "inventory_prices", "inventory_price_groups", column: "price_group_id", on_delete: :cascade
  add_foreign_key "inventory_prices", "inventory_products", column: "product_id", on_delete: :cascade
  add_foreign_key "inventory_products", "accounts"
  add_foreign_key "inventory_products", "inventory_catalogs", column: "catalog_id"
  add_foreign_key "inventory_products", "inventory_products", column: "parent_id"
  add_foreign_key "inventory_reservations", "accounts"
  add_foreign_key "inventory_reservations", "inventory_products", column: "product_id"
  add_foreign_key "inventory_reservations", "inventory_warehouses", column: "warehouse_id"
  add_foreign_key "inventory_source_settings", "accounts"
  add_foreign_key "inventory_source_settings", "inventory_warehouses", column: "warehouse_id", on_delete: :nullify
  add_foreign_key "inventory_stock_items", "accounts"
  add_foreign_key "inventory_stock_items", "inventory_products", column: "product_id"
  add_foreign_key "inventory_stock_items", "inventory_warehouses", column: "warehouse_id"
  add_foreign_key "inventory_warehouses", "accounts"
  add_foreign_key "memberships", "accounts"
  add_foreign_key "memberships", "users"
  add_foreign_key "module_licenses", "accounts"
  add_foreign_key "orders_items", "accounts"
  add_foreign_key "orders_items", "inventory_products", column: "product_id"
  add_foreign_key "orders_items", "orders_orders", column: "order_id"
  add_foreign_key "orders_number_sequences", "accounts"
  add_foreign_key "orders_orders", "accounts"
  add_foreign_key "orders_orders", "customers_customers", column: "customer_id"
  add_foreign_key "orders_orders", "inventory_price_groups", column: "price_group_id", on_delete: :nullify
  add_foreign_key "orders_orders", "inventory_warehouses", column: "warehouse_id"
  add_foreign_key "orders_status_changes", "accounts"
  add_foreign_key "orders_status_changes", "orders_orders", column: "order_id"
  add_foreign_key "orders_status_changes", "users"
  add_foreign_key "sessions", "users"
end
