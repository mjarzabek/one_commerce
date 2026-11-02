module Inventory
  # Zakładka „Magazyny”: magazyny konta (wybierane potem w katalogach) i źródła zamówień
  # (z którego magazynu schodzi towar i czy zamówienia rezerwują go od razu).
  class WarehousesController < BaseController
    def index
      warehouses = Inventory.warehouses(Current.account).includes(:catalogs).to_a
      units = StockItem.where(warehouse: warehouses).group(:warehouse_id).sum(:on_hand)

      render inertia: "core/inventory/warehouses/index", props: {
        warehouses: warehouses.map do |warehouse|
          { id: warehouse.id, name: warehouse.name, units: units.fetch(warehouse.id, 0),
            catalogs: warehouse.catalogs.sort_by { [ _1.position, _1.id ] }.map { { id: _1.id, name: _1.name } } }
        end,
        sources: Inventory.source_settings(Current.account)
      }
    end

    def create
      warehouse = Warehouse.new(account: Current.account, name: params[:name].to_s.strip,
        position: Warehouse.where(account: Current.account).maximum(:position).to_i + 1)
      if warehouse.save
        redirect_to inventory_warehouses_path, notice: "Dodano magazyn „#{warehouse.name}”. Zaznacz go w katalogach, które mają z niego korzystać."
      else
        redirect_with_errors(warehouse, to: inventory_warehouses_path)
      end
    end

    def update
      warehouse = find_warehouse
      if warehouse.update(name: params[:name].to_s.strip)
        redirect_to inventory_warehouses_path, notice: "Zapisano nazwę magazynu."
      else
        redirect_with_errors(warehouse, to: inventory_warehouses_path)
      end
    end

    def destroy
      warehouse = find_warehouse
      if StockItem.where(warehouse:).where("on_hand > 0").exists? || Movement.where(warehouse:).exists?
        return redirect_to inventory_warehouses_path, alert: "Nie można usunąć magazynu, który ma towar lub historię ruchów."
      end

      only_in = warehouse.catalogs.select { |catalog| catalog.warehouse_ids == [ warehouse.id ] }
      if only_in.any?
        return redirect_to inventory_warehouses_path,
          alert: "To jedyny magazyn katalogu „#{only_in.map(&:name).join("”, „")}” – najpierw zaznacz tam inny magazyn."
      end

      if Inventory.source_settings(Current.account).values.any? { _1[:warehouse_id] == warehouse.id }
        return redirect_to inventory_warehouses_path, alert: "Magazyn jest ustawiony dla źródła zamówień – najpierw wybierz tam inny."
      end

      Warehouse.transaction do
        StockItem.where(warehouse:).delete_all
        CatalogWarehouse.where(warehouse:).delete_all
        warehouse.destroy!
      end
      redirect_to inventory_warehouses_path, notice: "Usunięto magazyn „#{warehouse.name}”."
    end

    # PATCH /inventory/sources  source=live|ecommerce|manual, enabled=true|false i/lub warehouse_id
    def sources
      source = params[:source].to_s
      return head :unprocessable_entity unless Inventory::RESERVATION_SOURCES.include?(source)

      enabled = params.key?(:enabled) ? ActiveModel::Type::Boolean.new.cast(params[:enabled]) : nil
      warehouse = Warehouse.where(account: Current.account).find(params[:warehouse_id]) if params[:warehouse_id].present?
      Inventory.update_source_setting!(Current.account, source, enabled:, warehouse_id: warehouse&.id)

      notice =
        if warehouse then "Zamówienia z tego źródła będą realizowane z magazynu „#{warehouse.name}”."
        elsif enabled then "Rezerwacje włączone – nowe zamówienia od razu blokują towar."
        else "Rezerwacje wyłączone – towar zejdzie ze stanu przy wysyłce."
        end
      redirect_back_or_to inventory_warehouses_path, notice:
    end

    private
      def find_warehouse
        Warehouse.where(account: Current.account).find(params[:id])
      end
  end
end
