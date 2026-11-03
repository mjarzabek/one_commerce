module Inventory
  # Ustawienia → „Magazyny”: magazyny konta (wybierane potem w katalogach) i ścisła kontrola magazynowa.
  class WarehousesController < BaseController
    def index
      warehouses = Inventory.warehouses(Current.account).includes(:catalogs).to_a
      units = StockItem.where(warehouse: warehouses).group(:warehouse_id).sum(:on_hand)

      render inertia: "core/inventory/settings/warehouses", props: {
        warehouses: warehouses.map do |warehouse|
          { id: warehouse.id, name: warehouse.name, units: units.fetch(warehouse.id, 0), strict_control: warehouse.strict_control,
            catalogs: warehouse.catalogs.sort_by { [ _1.position, _1.id ] }.map { { id: _1.id, name: _1.name } } }
        end
      }
    end

    def create
      warehouse = Warehouse.new(account: Current.account, name: params[:name].to_s.strip,
        position: Warehouse.where(account: Current.account).maximum(:position).to_i + 1)
      if warehouse.save
        redirect_to inventory_settings_warehouses_path, notice: "Dodano magazyn."
      else
        redirect_with_errors(warehouse, to: inventory_settings_warehouses_path)
      end
    end

    # PATCH name=… (zmiana nazwy) albo strict_control=true|false (ścisła kontrola magazynowa).
    def update
      warehouse = find_warehouse
      if params.key?(:strict_control)
        strict = ActiveModel::Type::Boolean.new.cast(params[:strict_control])
        warehouse.update!(strict_control: strict)
        redirect_to inventory_settings_warehouses_path, notice: strict ? "Włączono ścisłą kontrolę." : "Wyłączono ścisłą kontrolę."
      elsif warehouse.update(name: params[:name].to_s.strip)
        redirect_to inventory_settings_warehouses_path, notice: "Zapisano nazwę magazynu."
      else
        redirect_with_errors(warehouse, to: inventory_settings_warehouses_path)
      end
    end

    def destroy
      warehouse = find_warehouse
      if StockItem.where(warehouse:).where("on_hand > 0").exists? || Movement.where(warehouse:).exists?
        return redirect_to inventory_settings_warehouses_path, alert: "Nie można usunąć magazynu, który ma towar lub historię ruchów."
      end

      only_in = warehouse.catalogs.select { |catalog| catalog.warehouse_ids == [ warehouse.id ] }
      if only_in.any?
        return redirect_to inventory_settings_warehouses_path,
          alert: "To jedyny magazyn katalogu „#{only_in.map(&:name).join("”, „")}” - najpierw zaznacz tam inny magazyn."
      end

      if Inventory.source_settings(Current.account).values.any? { _1[:warehouse_id] == warehouse.id }
        return redirect_to inventory_settings_warehouses_path, alert: "Magazyn jest ustawiony dla źródła zamówień - najpierw wybierz inny w Ustawieniach → Ogólne."
      end

      Warehouse.transaction do
        StockItem.where(warehouse:).delete_all
        CatalogWarehouse.where(warehouse:).delete_all
        warehouse.destroy!
      end
      redirect_to inventory_settings_warehouses_path, notice: "Usunięto magazyn „#{warehouse.name}”."
    end

    private
      def find_warehouse
        Warehouse.where(account: Current.account).find(params[:id])
      end
  end
end
