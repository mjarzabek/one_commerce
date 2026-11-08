# Kategorie produktów (drzewo: kategoria nadrzędna) - ogólne (catalog_id NULL, dla wszystkich katalogów) albo katalogu.
# Tworzone ręcznie (source "manual") albo importowane z marketplace'ów (source np. "allegro" + external_id).
# Produkt dostaje kategorię i producenta (zwykły tekst); wariant bez nich dziedziczy je z produktu głównego.
class CreateInventoryCategories < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_categories do |t|
      t.references :account, null: false, foreign_key: true
      t.references :catalog, foreign_key: { to_table: :inventory_catalogs }
      t.references :parent, foreign_key: { to_table: :inventory_categories }
      t.string :name, null: false
      t.string :source, null: false, default: "manual"
      t.string :external_id
      t.timestamps
    end
    add_index :inventory_categories, %i[account_id source external_id], unique: true, where: "external_id IS NOT NULL",
      name: "index_inventory_categories_on_external_id"

    add_column :inventory_products, :manufacturer, :string
    add_reference :inventory_products, :category, foreign_key: { to_table: :inventory_categories, on_delete: :nullify }
  end
end
