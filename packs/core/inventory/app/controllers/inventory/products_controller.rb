module Inventory
  # Lista produktów katalogu (z rozwijanymi wariantami) i karta produktu.
  class ProductsController < BaseController
    STATUS_LABELS = Product::STATUS_LABELS

    before_action :set_product, only: %i[edit update destroy stock price available]

    # Lista produktów katalogu: wyszukiwanie, filtry ze schematu ProductSearch::FILTERS, sortowanie, strony.
    def index
      search, warehouse, warehouses, groups = build_search
      group = search.price_group
      products = search.records
      variant_stock = Inventory.available(Current.account, products.flat_map { _1.variants.map(&:id) }, warehouse_id: warehouse&.id)
      price_label = ->(cents) { cents.compact.uniq.sort.values_at(0, -1).compact.uniq.map { Inventory.format_price(_1, group.currency) }.join(" - ").presence }
      # Rezerwacje w tych samych magazynach co kolumna „Stan” (wybrany albo wszystkie z katalogu).
      reserved = StockItem.where(account: Current.account, product_id: products.flat_map { [ _1.id, *_1.variants.map(&:id) ] },
        warehouse_id: warehouse ? warehouse.id : warehouses.map(&:id)).group(:product_id).sum(:reserved)
      # Cena do pola edycji z listy - tylko produkty sprzedawalne (prosty, wariant).
      price_input = ->(product) { Inventory.format_money_input(product.price_cents_in(group.id)) }

      render inertia: "core/inventory/products/index", props: {
        products: products.map do |product|
          variants = product.variants.to_a
          own_prices = variants.any? ? variants.map { _1.price_cents_in(group.id) } : [ product.price_cents_in(group.id) ]
          {
            id: product.id, name: product.name, sku: product.sku, ean: product.ean, status: product.status,
            price: price_label.(own_prices), stock: product.stock_value.to_i, sellable: variants.none?,
            reserved: variants.any? ? variants.sum { reserved.fetch(_1.id, 0) } : reserved.fetch(product.id, 0),
            priceInput: variants.any? ? nil : price_input.(product),
            variants: variants.map do |variant|
              { id: variant.id, name: variant.name, sku: variant.sku, ean: variant.ean,
                price: price_label.([ variant.price_cents_in(group.id) ]), stock: variant_stock.fetch(variant.id), sellable: true,
                reserved: reserved.fetch(variant.id, 0), priceInput: price_input.(variant) }
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
        warehouses: warehouses.map { { id: _1.id, name: _1.name, strict_control: _1.strict_control } },
        statuses: STATUS_LABELS,
        priceGroups: groups.map { { id: _1.id, name: _1.name, currency: _1.currency } }
      }
    end

    # POST /inventory/products/bulk - akcja na zaznaczonych produktach (`ids[]`) albo na wszystkich
    # pasujących do wyszukiwania i filtrów (`all=true` + te same parametry co lista).
    #   operation=delete | operation=status&new_status=archived
    # (`new_status`, nie `status` - `status` to filtr listy.)
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
          alert: "Nie można usunąć produktu, który ma towar, historię magazynową lub zamówienia - zmień status na „Zarchiwizowany”."
      end
    end

    def new
      product = Product.new(account: Current.account, catalog: current_catalog, tax_rate: 23)
      render inertia: "core/inventory/products/new", props: form_props(product)
    end

    def create
      catalog = catalogs.find(params.dig(:product, :catalog_id) || current_catalog.id)
      product = Product.new(account: Current.account, catalog:)
      # Nowy produkt prosty: od razu zakładka „Stan”, żeby uzupełnić stan.
      save(product, notice: "Dodano produkt. Uzupełnij stan albo dodaj warianty.", redirect_tab: "stock")
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
        price: prices.uniq.sort.values_at(0, -1).compact.uniq.map { Inventory.format_price(_1, group.currency) }.join(" - ").presence,
        priceGroup: group.name
      }
      render inertia: "core/inventory/products/edit", props:
    end

    def update
      save(@product, notice: "Zapisano zmiany.")
    end

    # PATCH /inventory/products/:id/stock  stock[<warehouse_id>]=<stan na stanie>
    # Zwykła edycja stanu w magazynach bez ścisłej kontroli; każda zmiana trafia do historii (z ilu na ile).
    def stock
      warehouse_ids = Inventory.warehouses(Current.account, catalog: @product.catalog).ids.map(&:to_s)
      levels = params.expect(stock: warehouse_ids).to_h
      invalid = levels.keys.reject { parse_on_hand(levels[_1]) }
      return stock_errors(invalid.to_h { [ _1, "Podaj stan (0 lub więcej)" ] }) if invalid.any?

      warehouse_id = nil
      StockItem.transaction do
        levels.each do |id, value|
          warehouse_id = id
          Inventory.set_on_hand!(Current.account, @product.id, parse_on_hand(value), warehouse_id: id.to_i, user: Current.user)
        end
      end
      redirect_back_or_to edit_path(@product, tab: "stock"), notice: "Zapisano stan."
    rescue ActiveRecord::RecordInvalid => e
      stock_errors(warehouse_id => e.record.errors.messages.values.flatten.to_sentence.upcase_first)
    rescue Inventory::StrictControl, Inventory::NotSellable => e
      stock_errors(warehouse_id => e.message)
    end

    # PATCH /inventory/products/:id/price  price_group_id=…&price=199,90 - cena w jednej grupie (edycja z listy).
    # Pusta cena usuwa cenę z grupy.
    def price
      group = price_groups(@product.catalog).find(params[:price_group_id])
      value = params[:price].to_s.strip
      cents = Inventory.parse_money(value) if value.present?
      error = "Produkt z wariantami nie ma własnej ceny - zmień ceny wariantów" unless @product.sellable?
      error ||= "Nieprawidłowa kwota - wpisz np. 199,99" if value.present? && cents.nil?
      return redirect_back_or_to(inventory_root_path, inertia: { errors: { price: error } }) if error

      Inventory.set_price!(Current.account, @product.id, group, cents)
      redirect_back_or_to inventory_root_path, notice: "Zapisano cenę „#{@product.display_name}”."
    end

    # PATCH /inventory/products/:id/available  warehouse_id=…&available=5 - dostępne sztuki w magazynie (edycja z listy).
    def available
      warehouse = Inventory.warehouses(Current.account, catalog: @product.catalog).find(params[:warehouse_id])
      available = parse_on_hand(params[:available])
      return redirect_back_or_to(inventory_root_path, inertia: { errors: { available: "Podaj stan (0 lub więcej)" } }) unless available

      Inventory.set_available!(Current.account, @product.id, available, warehouse_id: warehouse.id, user: Current.user)
      redirect_back_or_to inventory_root_path, notice: "Zapisano stan „#{@product.display_name}”."
    rescue Inventory::StrictControl, Inventory::NotSellable => e
      redirect_back_or_to inventory_root_path, inertia: { errors: { available: e.message } }
    end

    private
      def build_search
        warehouses = Inventory.warehouses(Current.account, catalog: current_catalog).to_a
        # Kolumna i filtr „Stan”: łącznie (domyślnie) albo w wybranym magazynie.
        warehouse = warehouses.find { _1.id == params[:warehouse_id].to_i }
        # Kolumna, sortowanie i filtr „Cena”: wybrana grupa cenowa katalogu (domyślnie - domyślna grupa katalogu).
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
        { alert: "#{message} Pominięto #{result.skipped.size} (#{names}) - mają towar, historię magazynową lub zamówienia; " \
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

      def parse_on_hand(value)
        on_hand = Integer(value.to_s.strip, 10, exception: false)
        on_hand if on_hand&.>=(0)
      end

      # Błędy pól stanu: { warehouse_id => komunikat } → errors["stock.<warehouse_id>"].
      def stock_errors(messages)
        errors = messages.to_h { |warehouse_id, message| [ "stock.#{warehouse_id}", [ message ] ] }
        redirect_back_or_to edit_path(@product, tab: "stock"), inertia: { errors: }
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
          # Formularz pokazuje ceny tylko w grupach katalogu produktu (przy nowym produkcie - wybranego katalogu).
          priceGroups: price_groups_json,
          catalogPriceGroups: catalogs.includes(:catalog_price_groups).to_h { [ _1.id.to_s, _1.price_group_ids ] },
          statuses: STATUS_LABELS,
          taxRates: Product::TAX_RATES.map(&:to_s)
        }
      end
  end
end
