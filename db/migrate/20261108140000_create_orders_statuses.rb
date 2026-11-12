# Własne statusy zamówień konta (z grupami) zamiast stałej listy. Status płatności zostaje osobnym polem,
# dochodzi metoda płatności (m.in. pobranie).
class CreateOrdersStatuses < ActiveRecord::Migration[8.1]
  # Domyślne statusy - te same, które tworzy Orders.ensure_setup!. Stare klucze → nazwy nowych statusów.
  GROUPS = [ "Do realizacji", "Zakończone" ].freeze
  DEFAULTS = [
    [ "Nowe", "blue", "Do realizacji", "new" ],
    [ "Potwierdzone", "violet", "Do realizacji", "confirmed" ],
    [ "W realizacji", "amber", "Do realizacji", "processing" ],
    [ "Wysłane", "sky", "Zakończone", "shipped" ],
    [ "Dostarczone", "green", "Zakończone", "delivered" ],
    [ "Anulowane", "red", nil, "cancelled" ],
    [ "Zwrócone", "gray", nil, "returned" ]
  ].freeze
  LEGACY = DEFAULTS.to_h { [ _1[3], _1[0] ] }.merge("paid" => "Nowe").freeze

  def up
    create_table :orders_status_groups do |t|
      t.references :account, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :orders_status_groups, %i[account_id name], unique: true

    create_table :orders_statuses do |t|
      t.references :account, null: false, foreign_key: true, index: false
      t.references :group, foreign_key: { to_table: :orders_status_groups, on_delete: :nullify }
      t.string :name, null: false
      t.string :color, null: false, default: "gray"
      t.integer :position, null: false, default: 0
      t.boolean :default, null: false, default: false
      t.timestamps
    end
    add_index :orders_statuses, %i[account_id name], unique: true
    add_index :orders_statuses, :account_id, unique: true, where: '"default"', name: "index_orders_statuses_one_default"

    add_reference :orders_orders, :status, foreign_key: { to_table: :orders_statuses }
    add_column :orders_orders, :payment_method, :string
    add_reference :orders_status_changes, :from_status, foreign_key: { to_table: :orders_statuses, on_delete: :nullify }
    add_reference :orders_status_changes, :to_status, foreign_key: { to_table: :orders_statuses, on_delete: :nullify }

    migrate_data

    change_column_null :orders_orders, :status_id, false
    remove_index :orders_orders, %i[account_id status]
    add_index :orders_orders, %i[account_id status_id]
    add_index :orders_orders, %i[account_id placed_at]
    remove_column :orders_orders, :status
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private
    def migrate_data
      select_values("SELECT DISTINCT account_id FROM orders_orders").each do |account_id|
        now = connection.quote(Time.current)
        groups = GROUPS.each_with_index.to_h do |name, position|
          id = insert(<<~SQL.squish)
            INSERT INTO orders_status_groups (account_id, name, position, created_at, updated_at)
            VALUES (#{account_id}, #{quote(name)}, #{position}, #{now}, #{now})
          SQL
          [ name, id ]
        end
        statuses = DEFAULTS.each_with_index.to_h do |(name, color, group, _key), position|
          id = insert(<<~SQL.squish)
            INSERT INTO orders_statuses (account_id, group_id, name, color, position, "default", created_at, updated_at)
            VALUES (#{account_id}, #{groups[group] || "NULL"}, #{quote(name)}, #{quote(color)}, #{position}, #{position.zero?}, #{now}, #{now})
          SQL
          [ name, id ]
        end

        LEGACY.each do |key, name|
          execute "UPDATE orders_orders SET status_id = #{statuses.fetch(name)} WHERE account_id = #{account_id} AND status = #{quote(key)}"
          %w[from to].each do |side|
            execute <<~SQL.squish
              UPDATE orders_status_changes SET #{side}_status_id = #{statuses.fetch(name)}, #{side}_status = #{quote(name)}
              WHERE account_id = #{account_id} AND #{side}_status = #{quote(key)}
            SQL
          end
        end
        execute "UPDATE orders_orders SET payment_status = 'paid' WHERE account_id = #{account_id} AND status = 'paid'"
      end
    end

    def quote(value) = connection.quote(value)
end
