module Api
  module V1
    class BaseController < ActionController::API
      include ActionController::HttpAuthentication::Token::ControllerMethods

      before_action :authenticate_token!

      rescue_from ActiveRecord::RecordNotFound do
        render_error :not_found, "Nie znaleziono zasobu."
      end

      private
        attr_reader :api_token

        def authenticate_token!
          account, token = authenticate_with_http_token { |raw, _| Accounts.authenticate_api_token(raw) }
          return render_error(:unauthorized, "Brak lub nieprawidłowy token API.") unless account

          Current.account = account
          @api_token = token
        end

        def require_scope!(scope)
          render_error(:forbidden, "Token nie ma zakresu #{scope}.") unless api_token.allows?(scope)
        end

        def require_module!(mod)
          render_error(:payment_required, "Konto nie ma aktywnego modułu #{mod}.") unless Licensing.enabled?(Current.account, mod)
        end

        def require_orders_panel!
          return if Licensing.orders_panel?(Current.account)

          render_error(:payment_required, "Zamówienia są dostępne z modułem Live lub MultiChannel.")
        end

        # Stronicowanie kursorem po rosnącym id: ?cursor=<id ostatniego elementu>&limit=50
        def paginate(scope)
          limit = params.fetch(:limit, 50).to_i.clamp(1, 100)
          scope = scope.where(id: (params[:cursor].to_i + 1)..) if params[:cursor].present?
          records = scope.reorder(:id).limit(limit + 1).to_a
          [ records.first(limit), records.size > limit ? records[limit - 1].id : nil ]
        end

        def render_error(status, message)
          render json: { error: { code: status, message: } }, status:
        end
    end
  end
end
