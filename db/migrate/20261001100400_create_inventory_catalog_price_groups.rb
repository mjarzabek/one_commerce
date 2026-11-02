# Grupy cenowe, z których korzysta katalog (wybierane w katalogu, jak magazyny).
# Istniejące katalogi dostają wszystkie grupy cenowe swojego konta.
class CreateInventoryCatalogPriceGroups < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_catalog_price_groups do |t|
      t.references :catalog, null: false, foreign_key: { to_table: :inventory_catalogs, on_delete: :cascade }, index: false
      t.references :price_group, null: false, foreign_key: { to_table: :inventory_price_groups, on_delete: :cascade }
    end
    add_index :inventory_catalog_price_groups, %i[catalog_id price_group_id], unique: true

    reversible do |dir|
      dir.up do
        execute <<~SQL
          INSERT INTO inventory_catalog_price_groups (catalog_id, price_group_id)
          SELECT c.id, g.id FROM inventory_catalogs c JOIN inventory_price_groups g ON g.account_id = c.account_id
        SQL
      end
    end
  end
end
