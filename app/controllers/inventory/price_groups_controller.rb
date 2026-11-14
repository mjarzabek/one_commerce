module Inventory
  # Ustawienia → „Ceny”: grupy cenowe (rynki, marketplace'y, waluty). Grupa domyślna obsługuje Live i zamówienia ręczne.
  class PriceGroupsController < BaseController
    def index
      priced = Price.where(account: Current.account).group(:price_group_id).count
      sellable = Product.sellable.where(account: Current.account).count

      render inertia: "core/inventory/settings/prices", props: {
        priceGroups: price_groups.includes(:catalogs).map do |group|
          { id: group.id, name: group.name, currency: group.currency, default: group.default, priced: priced.fetch(group.id, 0),
            catalogs: group.catalogs.sort_by { [ _1.position, _1.id ] }.map { { id: _1.id, name: _1.name } } }
        end,
        sellable:,
        currencies: PriceGroup::CURRENCIES
      }
    end

    def create
      group = PriceGroup.new(account: Current.account, position: price_groups.count, **group_params)
      if group.save
        redirect_to inventory_settings_price_groups_path, notice: "Dodano grupę cenową."
      else
        redirect_with_errors(group, to: inventory_settings_price_groups_path)
      end
    end

    def update
      group = price_groups.find(params[:id])
      if ActiveModel::Type::Boolean.new.cast(params[:default])
        group.make_default!
        return redirect_to inventory_settings_price_groups_path, notice: "Ustawiono domyślną grupę cenową."
      end

      if group.update(group_params)
        redirect_to inventory_settings_price_groups_path, notice: "Zapisano grupę cenową."
      else
        redirect_with_errors(group, to: inventory_settings_price_groups_path)
      end
    end

    def destroy
      group = price_groups.find(params[:id])
      return redirect_to inventory_settings_price_groups_path, alert: "Nie można usunąć domyślnej grupy cenowej." if group.default?

      only_in = group.catalogs.includes(:catalog_price_groups).select { |catalog| catalog.price_group_ids == [ group.id ] }
      if only_in.any?
        return redirect_to inventory_settings_price_groups_path,
          alert: "To jedyna grupa cenowa katalogu „#{only_in.map(&:name).join("”, „")}” - najpierw zaznacz tam inną."
      end

      group.destroy!
      redirect_to inventory_settings_price_groups_path, notice: "Usunięto grupę cenową „#{group.name}”."
    end

    private
      def group_params
        { name: params[:name].to_s.strip, currency: params[:currency].presence || "PLN" }
      end
  end
end
