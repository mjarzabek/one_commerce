module Inventory
  # Ustawienia → „Katalogi”: osobne zbiory produktów; każdy katalog korzysta z wybranych magazynów i grup cenowych.
  class CatalogsController < BaseController
    def index
      products = Product.main.where(account: Current.account).group(:catalog_id).count
      all_catalogs = catalogs.includes(:catalog_warehouses, :catalog_price_groups).to_a

      render inertia: "core/inventory/settings/catalogs", props: {
        catalogs: all_catalogs.map do |catalog|
          { id: catalog.id, name: catalog.name, products: products.fetch(catalog.id, 0),
            warehouse_ids: catalog.warehouse_ids, price_group_ids: catalog.price_group_ids }
        end,
        warehouses: Inventory.warehouses(Current.account).map { { id: _1.id, name: _1.name } },
        priceGroups: price_groups.map { { id: _1.id, name: _1.name, currency: _1.currency } }
      }
    end

    def create
      catalog = Catalog.new(account: Current.account, position: catalogs.count, **catalog_params)
      if catalog.save
        redirect_to inventory_settings_catalogs_path, notice: "Dodano katalog „#{catalog.name}”."
      else
        redirect_with_errors(catalog, to: inventory_settings_catalogs_path)
      end
    end

    def update
      catalog = catalogs.find(params[:id])
      if catalog.update(catalog_params)
        redirect_to inventory_settings_catalogs_path, notice: "Zapisano katalog „#{catalog.name}”."
      else
        redirect_with_errors(catalog, to: inventory_settings_catalogs_path)
      end
    end

    def destroy
      catalog = catalogs.find(params[:id])
      if catalogs.count == 1
        redirect_to inventory_settings_catalogs_path, alert: "Konto musi mieć co najmniej jeden katalog."
      elsif Product.where(catalog:).exists?
        redirect_to inventory_settings_catalogs_path, alert: "Nie można usunąć katalogu z produktami."
      else
        catalog.destroy!
        redirect_to inventory_settings_catalogs_path, notice: "Usunięto katalog „#{catalog.name}”."
      end
    end

    private
      def catalog_params
        { name: params[:name].to_s.strip, warehouse_ids: Array(params[:warehouse_ids]), price_group_ids: Array(params[:price_group_ids]) }
      end
  end
end
