module Api
  module V1
    # GET /api/v1/orders – zamówienia konta od najnowszych (?status=, ?source=, ?cursor=, ?limit=)
    # GET /api/v1/orders/:id – zamówienie z pozycjami i historią statusów
    class OrdersController < BaseController
      before_action -> { require_scope!("orders:read") }
      before_action :require_orders_panel!

      def index
        orders, next_cursor = Orders.list(Current.account, **params.permit(:cursor, :limit, :status, :source).to_h.symbolize_keys)
        render json: { data: orders.map { order_json(_1) }, meta: { next_cursor: } }
      end

      def show
        order = Orders.find(Current.account, params[:id])
        render json: {
          data: order_json(order).merge(
            status_changes: order.status_changes.map do |change|
              change.as_json(only: %i[from_status to_status note created_at])
            end
          )
        }
      end

      private
        def order_json(order)
          order.as_json(only: %i[
            id number source source_channel external_id warehouse_id status payment_status currency
            subtotal_cents shipping_cents total_cents shipping_method billing_address shipping_address notes placed_at
          ]).merge(
            customer: { id: order.customer_id, name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
            items: order.items.map { _1.as_json(only: %i[id product_id sku name quantity unit_price_cents tax_rate total_cents]) }
          )
        end
    end
  end
end
