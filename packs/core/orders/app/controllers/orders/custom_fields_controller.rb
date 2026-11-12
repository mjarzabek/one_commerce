module Orders
  # Ustawienia zamówień › Pola dodatkowe: własne pola zamówienia (tekst, liczba, lista, data, tak/nie).
  class CustomFieldsController < BaseController
    before_action :set_field, only: %i[update destroy]

    def index
      counts = CustomField.where(account: Current.account).ordered.to_h do |field|
        [ field.id, Order.where(account: Current.account).where("custom_fields ? :key", key: field.id.to_s).count ]
      end
      render inertia: "core/orders/settings/fields", props: {
        fields: Orders.custom_fields(Current.account).map do |field|
          { id: field.id, name: field.name, kind: field.kind, options: field.options, orders: counts.fetch(field.id, 0) }
        end,
        kinds: CustomField::KINDS
      }
    end

    def create
      field = CustomField.new(account: Current.account, **field_params, kind: params[:kind].to_s)
      if field.save
        redirect_to orders_settings_custom_fields_path, notice: "Dodano pole „#{field.name}”."
      else
        redirect_with_errors(field, to: orders_settings_custom_fields_path)
      end
    end

    def update
      if @field.update(field_params)
        redirect_to orders_settings_custom_fields_path, notice: "Zapisano pole."
      else
        redirect_with_errors(@field, to: orders_settings_custom_fields_path)
      end
    end

    def destroy
      @field.destroy!
      redirect_to orders_settings_custom_fields_path, notice: "Usunięto pole „#{@field.name}”."
    end

    # PATCH /orders/settings/fields/reorder - kolejność po przeciągnięciu (`ids`).
    def reorder
      CustomField.transaction { apply_order(CustomField.where(account: Current.account), params[:ids]) }
      redirect_to orders_settings_custom_fields_path
    end

    private
      def set_field
        @field = CustomField.where(account: Current.account).find(params[:id])
      end

      # Wartości listy z formularza: jedna w wierszu.
      def field_params
        { name: params[:name].to_s.strip, options: params[:options].to_s.split("\n") }
      end
  end
end
