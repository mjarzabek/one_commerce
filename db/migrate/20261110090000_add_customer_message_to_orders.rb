# Wiadomość od klienta zostawiona przy składaniu zamówienia (sklep, Allegro) - osobno od notatki wewnętrznej (`notes`).
class AddCustomerMessageToOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :orders_orders, :customer_message, :text
  end
end
