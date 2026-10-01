module Orders
  # Lista zamówień ze wszystkich źródeł (Live, Allegro, sklepy, ręczne).
  class OrdersController < InertiaController
    requires_orders_panel

    def index
      render inertia: "core/orders/index", props: { orders: [] }
    end
  end
end
