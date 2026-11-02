module Api
  module V1
    # GET /api/v1/customers – klienci z tożsamościami w kanałach (?cursor=, ?limit=)
    class CustomersController < BaseController
      before_action -> { require_scope!("customers:read") }
      before_action :require_orders_panel!

      def index
        customers, next_cursor = paginate(Customers.list(Current.account))
        render json: { data: customers.map { customer_json(_1) }, meta: { next_cursor: } }
      end

      def show
        render json: { data: customer_json(Customers.find(Current.account, params[:id])) }
      end

      private
        def customer_json(customer)
          customer.as_json(only: %i[id name email phone default_address created_at]).merge(
            identities: customer.identities.map { _1.as_json(only: %i[channel external_id handle]) }
          )
        end
    end
  end
end
