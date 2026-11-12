# Punkt odbioru (paczkomat, punkt kurierski), znacznik „klient chce fakturę” i pola dodatkowe zamówień
# definiowane przez konto (wartości w jsonb zamówienia: { "<id pola>" => wartość }).
class AddPickupPointAndCustomFieldsToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders_orders, :pickup_point, :jsonb, null: false, default: {}
    add_column :orders_orders, :wants_invoice, :boolean, null: false, default: false
    add_column :orders_orders, :custom_fields, :jsonb, null: false, default: {}

    create_table :orders_custom_fields do |t|
      t.references :account, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.string :kind, null: false, default: "text"
      t.jsonb :options, null: false, default: []
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :orders_custom_fields, %i[account_id name], unique: true
  end
end
