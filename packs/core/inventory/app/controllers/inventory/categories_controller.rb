module Inventory
  # Ustawienia → „Kategorie”: drzewo kategorii produktów - ogólnych i katalogów, ręcznych i importowanych z marketplace'ów.
  class CategoriesController < BaseController
    SOURCE_LABELS = { Category::MANUAL => "Ręczna", "allegro" => "Allegro" }.freeze

    def index
      all = Category.where(account: Current.account).to_a
      index = all.index_by(&:id)
      products = Product.where(account: Current.account, category_id: all.map(&:id)).group(:category_id).count

      render inertia: "core/inventory/settings/categories", props: {
        categories: all.map do |category|
          { id: category.id, name: category.name, path: category.path(index), catalog_id: category.catalog_id,
            parent_id: category.parent_id, source: SOURCE_LABELS.fetch(category.source) { category.source.titleize },
            products: products.fetch(category.id, 0) }
        end.sort_by { _1[:path].downcase },
        catalogs: catalogs_json
      }
    end

    def create
      category = Category.new(account: Current.account, **category_params)
      if category.save
        redirect_to inventory_settings_categories_path, notice: "Dodano kategorię."
      else
        redirect_with_errors(category, to: inventory_settings_categories_path)
      end
    end

    def update
      category = find_category
      if category.update(category_params)
        redirect_to inventory_settings_categories_path, notice: "Zapisano kategorię."
      else
        redirect_with_errors(category, to: inventory_settings_categories_path)
      end
    end

    def destroy
      category = find_category
      if category.destroy
        redirect_to inventory_settings_categories_path, notice: "Usunięto kategorię „#{category.name}”."
      else
        redirect_to inventory_settings_categories_path, alert: "Nie można usunąć kategorii z podkategoriami - najpierw usuń albo przenieś podkategorie."
      end
    end

    private
      def find_category
        Category.where(account: Current.account).find(params[:id])
      end

      # Katalog i nadrzędna z formularza: puste = kategoria ogólna / główna (bez nadrzędnej).
      def category_params
        {
          name: params[:name].to_s,
          catalog: params[:catalog_id].present? ? catalogs.find(params[:catalog_id]) : nil,
          parent: params[:parent_id].present? ? Category.where(account: Current.account).find(params[:parent_id]) : nil
        }
      end
  end
end
