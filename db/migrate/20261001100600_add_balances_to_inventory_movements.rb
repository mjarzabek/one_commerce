# Historia ruchów ze stanem przed i po zmianie (w danym magazynie) oraz czytelne opisy posiadacza
# rezerwacji / ruchu (np. „Zamówienie 2026/000004” zamiast „Orders::Order#12”).
class AddBalancesToInventoryMovements < ActiveRecord::Migration[8.1]
  def change
    add_column :inventory_movements, :on_hand_before, :integer
    add_column :inventory_movements, :on_hand_after, :integer
    add_column :inventory_movements, :holder_label, :string
    add_column :inventory_reservations, :holder_label, :string

    reversible do |dir|
      dir.up do
        # Każda zmiana on_hand ma swój ruch, więc stan po ruchu = suma ruchów do niego włącznie.
        execute <<~SQL
          UPDATE inventory_movements m
          SET on_hand_after = b.after, on_hand_before = b.after - m.quantity
          FROM (
            SELECT id, SUM(quantity) OVER (PARTITION BY warehouse_id, product_id ORDER BY id) AS after
            FROM inventory_movements
          ) b
          WHERE b.id = m.id
        SQL
      end
    end

    change_column_null :inventory_movements, :on_hand_before, false
    change_column_null :inventory_movements, :on_hand_after, false
  end
end
