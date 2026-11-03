module Api
  module V1
    # GET /api/v1/stock - stany produktów w magazynach (?cursor=, ?limit=)
    class StockController < BaseController
      before_action -> { require_scope!("inventory:read") }
      before_action :require_orders_panel!

      def index
        items, next_cursor = paginate(Inventory.stock_items(Current.account))
        products = Inventory.find_products(Current.account, ids: items.map(&:product_id)).index_by(&:id)
        render json: {
          data: items.map do |item|
            { product_id: item.product_id, sku: products[item.product_id]&.sku, warehouse_id: item.warehouse_id,
              on_hand: item.on_hand, reserved: item.reserved, available: item.available }
          end,
          meta: { next_cursor: }
        }
      end
    end
  end
end
