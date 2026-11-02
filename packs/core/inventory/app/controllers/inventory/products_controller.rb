module Inventory
  # Lista produktów katalogu (z rozwijanymi wariantami) i karta produktu.
  class ProductsController < BaseController
    STATUS_LABELS = Product::STATUS_LABELS

    before_action :set_product, only: %i[edit update destroy adjustments]

    # Lista produktów katalogu: wyszukiwanie, filtry ze schematu ProductSearch::FILTERS, sortowanie, strony.
    def index
      search, warehouse, warehouses, groups = build_search
      group = search.price_group
      products = search.records
      variant_stock = Inventory.available(Current.account, products.flat_map { _1.variants.map(&:id) }, warehouse_id: warehouse&.id)
      price_label = ->(cents) { cents.compact.uniq.sort.values_at(0, -1).compact.uniq.map { Inventory.format_price(_1, group.currency) }.join(" – ").presence }

      render inertia: "core/inventory/products/index", props: {
        products: products.map do |product|
          variants = product.variants.to_a
          own_prices = variants.any? ? variants.map { _1.price_cents_in(group.id) } : [ product.price_cents_in(group.id) ]
          {
            id: product.id, name: product.name, sku: product.sku, ean: product.ean, status: product.status,
            price: price_label.(own_prices), stock: product.stock_value.to_i,
            variants: variants.map do |variant|
              { id: variant.id, name: variant.name, sku: variant.sku, ean: variant.ean,
                price: price_label.([ variant.price_cents_in(group.id) ]), stock: variant_stock.fetch(variant.id) }
            end
          }
        end,
        pagination: { page: search.pagy.page, pages: search.pagy.pages, per: search.pagy.limit, total: search.pagy.count },
        filterSchema: search.schema.map do |filter|
          filter[:key] == "price" ? filter.merge(unit: group.currency == "PLN" ? "zł" : group.currency) : filter
        end,
        filters: search.param_values,
        view: { q: search.query, catalog_id: current_catalog.id, warehouse_id: warehouse&.id, price_group_id: group.id,
                sort: search.sort, dir: search.direction },
        catalogs: catalogs_json,
        catalog: { id: current_catalog.id, name: current_catalog.name },
        warehouses: warehouses.map { { id: _1.id, name: _1.name } },
        statuses: STATUS_LABELS,
        priceGroups: groups.map { { id: _1.id, name: _1.name, currency: _1.currency } }
      }
    end

    # POST /inventory/products/bulk – akcja na zaznaczonych produktach (`ids[]`) albo na wszystkich
    # pasujących do wyszukiwania i filtrów (`all=true` + te same parametry co lista).
    #   operation=delete | operation=status&new_status=archived
    # (`new_status`, nie `status` – `status` to filtr listy.)
    def bulk
      all = ActiveModel::Type::Boolean.new.cast(params[:all])
      ids = all ? build_search.first.ids - Array(params[:excluded_ids]).map(&:to_i) : Array(params[:ids]).map(&:to_i)
      return redirect_back_or_to(inventory_root_path, alert: "Nie zaznaczono produktów.") if ids.empty?

      case params[:operation]
      when "delete"
        result = Inventory.delete_products!(Current.account, ids)
        redirect_back_or_to inventory_root_path, **delete_flash(result)
      when "status"
        return redirect_back_or_to(inventory_root_path, alert: "Nieznany status.") unless STATUS_LABELS.key?(params[:new_status])

        count = Inventory.update_status!(Current.account, ids, params[:new_status])
        redirect_back_or_to inventory_root_path, notice: "Zmieniono status #{count} #{products_word(count)} na „#{STATUS_LABELS[params[:new_status]]}”."
      else
        redirect_back_or_to inventory_root_path, alert: "Nieznana akcja."
      end
    end

    def destroy
      result = Inventory.delete_products!(Current.account, [ @product.main_product.id ])
      if result.deleted.positive?
        redirect_to inventory_root_path(catalog_id: @product.catalog_id), notice: "Usunięto produkt „#{@product.name}”."
      else
        redirect_to edit_inventory_product_path(@product),
          alert: "Nie można usunąć produktu, który ma towar, historię magazynową lub zamówienia – zmień status na „Zarchiwizowany”."
      end
    end

    def new
      product = Product.new(account: Current.account, catalog: current_catalog, tax_rate: 23)
      render inertia: "core/inventory/products/new", props: form_props(product)
    end

    def create
      catalog = catalogs.find(params.dig(:product, :catalog_id) || current_catalog.id)
      product = Product.new(account: Current.account, catalog:)
      # Nowy produkt prosty: od razu zakładka „Stan”, żeby przyjąć towar.
      save(product, notice: "Dodano produkt. Przyjmij towar na stan albo dodaj warianty.", redirect_tab: "stock")
    end

    # Karta produktu z zakładkami: Ogólne, Ceny, Stan, Historia, Warianty, Marketplace.
    def edit
      group = Inventory.default_price_group(Current.account, catalog: @product.catalog)
      props = form_props(@product)
      if @product.with_variants?
        warehouses = Inventory.warehouses(Current.account, catalog: @product.catalog).to_a
        levels = Inventory.stock_levels(Current.account, @product.variants.map(&:id))
        available = Inventory.available(Current.account, @product.variants.map(&:id))
        props[:variants] = @product.variants.map do |variant|
          items = levels.fetch(variant.id, {})
          { id: variant.id, name: variant.name, sku: variant.sku, ean: variant.ean,
            price: Inventory.format_price(variant.price_cents_in(group.id), group.currency), available: available.fetch(variant.id),
            levels: warehouses.to_h { |w| [ w.id.to_s, { on_hand: items[w.id]&.on_hand || 0, reserved: items[w.id]&.reserved || 0 } ] } }
        end
        props[:warehouses] = warehouses.map { { id: _1.id, name: _1.name } }
        prices = @product.variants.filter_map { _1.price_cents_in(group.id) }
      else
        props[:stock] = stock_json(@product)
        prices = [ @product.price_cents_in(group.id) ].compact
      end
      props[:summary] = {
        available: Inventory.available(Current.account, [ @product.id ]).fetch(@product.id),
        price: prices.uniq.sort.values_at(0, -1).compact.uniq.map { Inventory.format_price(_1, group.currency) }.join(" – ").presence,
        priceGroup: group.name
      }
      render inertia: "core/inventory/products/edit", props:
    end

    def update
      save(@product, notice: "Zapisano zmiany.")
    end

    # POST /inventory/products/:id/adjustments  mode=receive|set, warehouse_id, quantity, note
    def adjustments
      warehouse = Inventory.warehouses(Current.account, catalog: @product.catalog).find(params[:warehouse_id])
      quantity = Integer(params[:quantity].to_s, 10, exception: false)
      note = params[:note].presence

      case params[:mode]
      when "receive"
        return quantity_error("Podaj liczbę sztuk większą od zera") unless quantity&.positive?

        Inventory.receive!(Current.account, @product.id, quantity, warehouse_id: warehouse.id, reference: note, user: Current.user)
        notice = "Przyjęto #{quantity} szt. do: #{warehouse.name}."
      when "set"
        return quantity_error("Podaj stan (0 lub więcej)") unless quantity && quantity >= 0

        Inventory.set_on_hand!(Current.account, @product.id, quantity, warehouse_id: warehouse.id, reference: note, user: Current.user)
        notice = "Ustawiono stan #{quantity} szt. w: #{warehouse.name}."
      else
        return quantity_error("Nieznany rodzaj zmiany")
      end

      redirect_back_or_to edit_path(@product, tab: "stock"), notice:
    rescue ActiveRecord::RecordInvalid => e
      quantity_error(e.record.errors.full_messages.to_sentence)
    rescue Inventory::NotSellable => e
      quantity_error(e.message)
    end

    private
      def build_search
        warehouses = Inventory.warehouses(Current.account, catalog: current_catalog).to_a
        # Kolumna i filtr „Stan”: łącznie (domyślnie) albo w wybranym magazynie.
        warehouse = warehouses.find { _1.id == params[:warehouse_id].to_i }
        # Kolumna, sortowanie i filtr „Cena”: wybrana grupa cenowa katalogu (domyślnie – domyślna grupa katalogu).
        groups = price_groups(current_catalog).to_a
        group = groups.find { _1.id == params[:price_group_id].to_i } || groups.first
        search = ProductSearch.new(account: Current.account, catalog: current_catalog,
          warehouse_ids: warehouse ? [ warehouse.id ] : warehouses.map(&:id), price_group: group, params:)
        [ search, warehouse, warehouses, groups ]
      end

      def delete_flash(result)
        message = result.deleted.positive? ? "Usunięto #{result.deleted} #{products_word(result.deleted)}." : "Nie usunięto żadnego produktu."
        return { notice: message } if result.skipped.empty?

        names = result.skipped.first(3).join(", ") + (result.skipped.size > 3 ? " i #{result.skipped.size - 3} innych" : "")
        { alert: "#{message} Pominięto #{result.skipped.size} (#{names}) – mają towar, historię magazynową lub zamówienia; " \
                 "zmień im status na „Zarchiwizowany”." }
      end

      def products_word(count)
        return "produkt" if count == 1
        return "produkty" if (2..4).cover?(count % 10) && !(12..14).cover?(count % 100)

        "produktów"
      end

      def set_product
        @product = Product.where(account: Current.account).includes(:prices, :parent, variants: :prices).find(params[:id])
      end

      def edit_path(product, **query)
        product.variant? ? edit_inventory_variant_path(product, **query) : edit_inventory_product_path(product, **query)
      end

      def quantity_error(message)
        redirect_back_or_to edit_path(@product, tab: "stock"), inertia: { errors: { quantity: [ message ] } }
      end

      # Zakładka karty, na którą wracamy po zapisie (?tab=prices itd.).
      def tab = params[:tab].presence

      def save(product, notice:, redirect_tab: tab)
        product.assign_attributes(product_params(product))
        if product.save
          redirect_to edit_inventory_product_path(product, tab: redirect_tab), notice:
        else
          target = product.persisted? ? edit_inventory_product_path(product, tab:) : new_inventory_product_path(catalog_id: product.catalog_id, tab:)
          redirect_with_errors(product, to: target)
        end
      end

      def product_params(product)
        permitted = params.expect(product: [ :name, :sku, :ean, :description, :status, :tax_rate, price_inputs: {} ])
        if product.persisted? && product.with_variants?
          permitted.delete(:price_inputs)
        elsif permitted.key?(:price_inputs)
          permitted[:price_inputs] = catalog_price_inputs(permitted[:price_inputs], product.catalog)
        end
        permitted
      end

      def form_props(product)
        {
          product: {
            id: product.id, catalog_id: product.catalog_id, name: product.name.to_s, sku: product.sku.to_s, ean: product.ean.to_s,
            description: product.description.to_s, status: product.status, tax_rate: product.tax_rate.to_i.to_s,
            prices: price_inputs_json(product), hasVariants: product.persisted? && product.with_variants?
          },
          catalog: { id: product.catalog.id, name: product.catalog.name },
          catalogs: catalogs_json,
          # Formularz pokazuje ceny tylko w grupach katalogu produktu (przy nowym produkcie – wybranego katalogu).
          priceGroups: price_groups_json,
          catalogPriceGroups: catalogs.includes(:catalog_price_groups).to_h { [ _1.id.to_s, _1.price_group_ids ] },
          statuses: STATUS_LABELS,
          taxRates: Product::TAX_RATES.map(&:to_s)
        }
      end
  end
end
