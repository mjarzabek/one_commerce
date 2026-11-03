# Bazowy kontroler wszystkich ekranów panelu (Inertia + React).
# Moduły (Live, MultiChannel, Chat) i Core dziedziczą z niego.
class InertiaController < ApplicationController
  include Accounts::Authentication
  include Licensing::RequiresModule

  # Komunikaty: `notice` - sukces, `warning` - uwaga, `alert` - błąd (frontend pokazuje je jako kolorowe toasty).
  add_flash_types :warning

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

  private
    # Błędy walidacji w formacie formularzy Inertia: { "name" => [...], "variants.0.sku" => [...] }.
    def inertia_errors(record)
      record.errors.each_with_object({}) do |error, result|
        key = error.attribute.to_s.gsub(/\[(\d+)\]/, '.\1')
        message = error.attribute == :base ? error.message : error.message.upcase_first
        (result[key] ||= []) << message
      end
    end
end
