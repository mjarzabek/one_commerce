# ID produktów (pokazywane w panelu i w API) zaczynają się od 110 000 000, żeby nie zdradzały liczby produktów
# na platformie. Istniejące produkty zachowują swoje ID. Przy nowej bazie (ładowanie schematu) to samo robi
# Inventory.ensure_product_id_start!.
class StartInventoryProductIdsAt110000000 < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL
      SELECT setval(pg_get_serial_sequence('inventory_products', 'id'), 110000000, false)
      WHERE (SELECT COALESCE(MAX(id), 0) FROM inventory_products) < 110000000
    SQL
  end

  def down
    # Sekwencji nie cofamy - ID już nadane muszą pozostać unikalne.
  end
end
