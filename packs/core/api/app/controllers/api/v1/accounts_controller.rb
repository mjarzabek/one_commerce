module Api
  module V1
    # GET /api/v1/account - konto powiązane z tokenem i jego moduły.
    class AccountsController < BaseController
      def show
        render json: {
          data: {
            id: Current.account.id,
            name: Current.account.name,
            modules: Licensing.summary(Current.account)
          }
        }
      end
    end
  end
end
