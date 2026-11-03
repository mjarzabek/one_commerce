module Orders
  # Lista zamówień ze wszystkich źródeł (Live, Allegro, sklepy, ręczne).
  class OrdersController < InertiaController
    requires_orders_panel

    def index
      orders, _next_cursor = Orders.list(Current.account, limit: 100)
      render inertia: "core/orders/index", props: {
        orders: orders.map do |order|
          {
            id: order.id,
            number: order.number,
            source: SOURCE_LABELS.fetch(order.source),
            customer: order.customer_name.presence || "-",
            total: Orders.format_money(order.total_cents, order.currency),
            status: STATUS_LABELS.fetch(order.status)
          }
        end
      }
    end
  end
end
