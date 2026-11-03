module Inventory
  # Ustawienia → „Ogólne”: źródła zamówień (z którego magazynu schodzi towar i czy zamówienia rezerwują go od razu).
  class SettingsController < BaseController
    def general
      render inertia: "core/inventory/settings/general", props: {
        warehouses: Inventory.warehouses(Current.account).map { { id: _1.id, name: _1.name } },
        sources: Inventory.source_settings(Current.account)
      }
    end

    # PATCH /inventory/settings/sources  source=live|ecommerce|manual, enabled=true|false i/lub warehouse_id
    def sources
      source = params[:source].to_s
      return head :unprocessable_entity unless Inventory::RESERVATION_SOURCES.include?(source)

      enabled = params.key?(:enabled) ? ActiveModel::Type::Boolean.new.cast(params[:enabled]) : nil
      warehouse = Warehouse.where(account: Current.account).find(params[:warehouse_id]) if params[:warehouse_id].present?
      Inventory.update_source_setting!(Current.account, source, enabled:, warehouse_id: warehouse&.id)

      notice =
        if warehouse then "Zapisano ustawienia."
        elsif enabled then "Włączono rezerwacje."
        else "Wyłączono rezerwacje."
        end
      redirect_back_or_to inventory_settings_general_path, notice:
    end
  end
end
