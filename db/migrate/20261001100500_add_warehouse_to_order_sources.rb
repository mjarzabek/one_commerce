# Magazyn zamówień wybierany per źródło (Live / E-commerce / Ręczne) zamiast „kolejności magazynów”.
# Ustawienia rezerwacji stają się ustawieniami źródła: magazyn + czy rezerwować. Zamówienie zapamiętuje swój magazyn.
class AddWarehouseToOrderSources < ActiveRecord::Migration[8.1]
  def change
    rename_table :inventory_reservation_policies, :inventory_source_settings
    add_reference :inventory_source_settings, :warehouse, foreign_key: { to_table: :inventory_warehouses, on_delete: :nullify }
    add_reference :orders_orders, :warehouse, foreign_key: { to_table: :inventory_warehouses }
  end
end
