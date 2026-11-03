# Zdjęcia produktu w ustalonej kolejności - pierwsze jest zdjęciem głównym. Plik w Active Storage.
class CreateInventoryProductImages < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_product_images do |t|
      t.references :account, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: { to_table: :inventory_products, on_delete: :cascade }
      t.integer :position, default: 0, null: false
      t.timestamps
    end
  end
end
