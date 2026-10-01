module Api
  module V1
    # GET /api/v1/orders – szkielet; dane pojawią się razem z modelem zamówień w Core.
    class OrdersController < BaseController
      before_action -> { require_scope!("orders:read") }
      before_action :require_orders_panel!

      def index
        render json: { data: [], meta: { next_cursor: nil } }
      end
    end
  end
end
