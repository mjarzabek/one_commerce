# Kwota wpłacona przez klienta (jak „Zapłacono X z Y” w BaseLinkerze). Status płatności wynika z niej:
# unpaid (0) | partial | paid | overpaid. Zwrotów nie ma jako statusu - zwrot obniża wpłaconą kwotę.
class AddPaidCentsToOrders < ActiveRecord::Migration[8.1]
  def up
    add_column :orders_orders, :paid_cents, :integer, null: false, default: 0
    execute "UPDATE orders_orders SET paid_cents = total_cents WHERE payment_status = 'paid'"
    execute "UPDATE orders_orders SET payment_status = 'unpaid' WHERE payment_status = 'refunded'"
  end

  def down
    execute "UPDATE orders_orders SET payment_status = 'paid' WHERE payment_status IN ('partial', 'overpaid')"
    remove_column :orders_orders, :paid_cents
  end
end
