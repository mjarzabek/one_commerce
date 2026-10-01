# Bazowy kontroler wszystkich ekranów panelu (Inertia + React).
# Moduły (Live, MultiChannel, Chat) i Core dziedziczą z niego.
class InertiaController < ApplicationController
  include Accounts::Authentication
  include Licensing::RequiresModule

  inertia_share do
    if Current.user
      {
        app: { name: Rails.configuration.x.app_name },
        auth: {
          user: Current.user.as_json(only: %i[id name email_address]).merge("initials" => Current.user.initials)
        },
        account: Current.account&.as_json(only: %i[id name]),
        modules: Licensing.summary(Current.account)
      }
    else
      { app: { name: Rails.configuration.x.app_name } }
    end
  end
end
