# Ścisła kontrola magazynowa (osobno dla magazynu): stan zmienia się tylko dokumentami magazynowymi,
# bez ręcznej edycji na karcie produktu.
class AddStrictControlToInventoryWarehouses < ActiveRecord::Migration[8.1]
  def change
    add_column :inventory_warehouses, :strict_control, :boolean, default: false, null: false
  end
end
