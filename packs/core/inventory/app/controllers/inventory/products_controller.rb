module Inventory
  # Lista produktów katalogu (z rozwijanymi wariantami) i karta produktu.
  class ProductsController < BaseController
    STATUS_LABELS = Product::STATUS_LABELS
    # Zapamiętany sposób wyświetlania listy (cookie, osobno dla konta). Filtrów, wyszukiwania i strony nie zapamiętujemy.
    VIEW_KEYS = %w[catalog_id warehouse_id price_group_id sort dir per].freeze
    ALL_WAREHOUSES = "all"

    before_action :set_product, only: %i[edit update destroy price available duplicate]
    before_action :restore_view, only: :index

    # Lista produktów katalogu: wyszukiwanie, filtry ze schematu ProductSearch::FILTERS, sortowanie, strony.
    # Przy wejściu na listę produkty i stronicowanie dochodzą osobnym zapytaniem (deferred) - strona z paskiem narzędzi
    # pokazuje się od razu, a tabela w tym czasie ma skeleton.
    def index
      search, warehouse, warehouses, groups = build_search
      group = search.price_group
      remember_view(search, warehouse, group)
      list = ->(block) { from_list? ? block : InertiaRails.defer(group: "list", &block) }

      render inertia: "core/inventory/products/index", props: {
        products: list.(-> { products_json(search, warehouse, warehouses, group) }),
        pagination: list.(-> { { page: search.pagy.page, pages: search.pagy.pages, per: search.pagy.limit, total: search.pagy.count } }),
        filterSchema: search.schema.map do |filter|
          filter[:key] == "price" ? filter.merge(unit: group.currency) : filter
        end,
        filters: search.param_values,
        view: { q: search.query, catalog_id: current_catalog.id, warehouse_id: warehouse&.id, price_group_id: group.id,
                sort: search.sort, dir: search.direction, per: search.per },
        catalogs: catalogs_json,
        catalog: { id: current_catalog.id, name: current_catalog.name },
        warehouses: warehouses.map { { id: _1.id, name: _1.name, strict_control: _1.strict_control } },
        statuses: STATUS_LABELS,
        priceGroups: groups.map { { id: _1.id, name: _1.name, currency: _1.currency } }
      }
    end

    # POST /inventory/products/bulk - akcja na zaznaczonych produktach (`ids[]`) albo na wszystkich
    # pasujących do wyszukiwania i filtrów (`all=true` + te same parametry co lista).
    #   operation=delete | operation=status&new_status=draft
    # (`new_status`, nie `status` - `status` to filtr listy.)
    def bulk
      all = ActiveModel::Type::Boolean.new.cast(params[:all])
      ids = all ? build_search.first.ids - Array(params[:excluded_ids]).map(&:to_i) : Array(params[:ids]).map(&:to_i)
      return redirect_back_or_to(inventory_root_path, alert: "Nie zaznaczono produktów.") if ids.empty?

      case params[:operation]
      when "delete"
        count = Inventory.delete_products!(Current.account, ids)
        redirect_back_or_to inventory_root_path, notice: "Usunięto #{count} #{products_word(count)}."
      when "status"
        return redirect_back_or_to(inventory_root_path, alert: "Nieznany status.") unless STATUS_LABELS.key?(params[:new_status])

        count = Inventory.update_status!(Current.account, ids, params[:new_status])
        redirect_back_or_to inventory_root_path, notice: "Zmieniono status #{count} #{products_word(count)} na „#{STATUS_LABELS[params[:new_status]]}”."
      else
        redirect_back_or_to inventory_root_path, alert: "Nieznana akcja."
      end
    end

    def destroy
      Inventory.delete_products!(Current.account, [ @product.main_product.id ])
      redirect_to inventory_root_path(catalog_id: @product.catalog_id), notice: "Usunięto produkt „#{@product.name}”."
    end

    # POST /inventory/products/:id/duplicate - kopia jako szkic (bez stanu i historii), otwiera się jej karta.
    def duplicate
      copy = Inventory.duplicate_product!(Current.account, @product.main_product.id)
      redirect_to edit_inventory_product_path(copy), notice: "Utworzono kopię produktu. Sprawdź SKU i EAN, a potem uzupełnij stan."
    end

    def new
      product = Product.new(account: Current.account, catalog: current_catalog, tax_rate: 23, status: :draft)
      render inertia: "core/inventory/products/new", props: form_props(product)
    end

    def create
      catalog = catalogs.find(params.dig(:product, :catalog_id) || current_catalog.id)
      product = Product.new(account: Current.account, catalog:)
      # Nowy produkt: od razu zakładka „Sprzedaż”, żeby uzupełnić stan.
      save(product, notice: "Dodano produkt.", redirect_tab: "sales")
    end

    # Karta produktu: zakładki Karta produktu, Sprzedaż (ceny, VAT, stan - produkt prosty), Warianty, Historia,
    # Rezerwacje, Kanały. Produkt z wariantami pokazuje tylko wartości wyliczone z wariantów (`summary`).
    def edit
      group = Inventory.default_price_group(Current.account, catalog: @product.catalog)
      props = form_props(@product).merge(
        images: images_json(@product),
        activity: activity_json(@product),
        reservationsEnabled: reservations_enabled?
      )
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

    # PATCH /inventory/products/:id  product[…] (dane, ceny) i stock[<warehouse_id>]=<na stanie> - zapisywane razem.
    def update
      save(@product, notice: "Zapisano zmiany.")
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
      redirect_back_or_to inventory_root_path, notice: "Zapisano cenę."
    end

    # PATCH /inventory/products/:id/available  warehouse_id=…&available=5 - dostępne sztuki w magazynie (edycja z listy).
    def available
      warehouse = Inventory.warehouses(Current.account, catalog: @product.catalog).find(params[:warehouse_id])
      available = parse_on_hand(params[:available])
      return redirect_back_or_to(inventory_root_path, inertia: { errors: { available: "Podaj stan (0 lub więcej)" } }) unless available

      Inventory.set_available!(Current.account, @product.id, available, warehouse_id: warehouse.id, user: Current.user)
      redirect_back_or_to inventory_root_path, notice: "Zapisano stan."
    rescue Inventory::StrictControl, Inventory::NotSellable => e
      redirect_back_or_to inventory_root_path, inertia: { errors: { available: e.message } }
    end

    private
      def products_json(search, warehouse, warehouses, group)
        products = search.records
        variant_stock = Inventory.available(Current.account, products.flat_map { _1.variants.map(&:id) }, warehouse_id: warehouse&.id)
        price_label = ->(cents) { cents.compact.uniq.sort.values_at(0, -1).compact.uniq.map { Inventory.format_price(_1, group.currency) }.join(" - ").presence }
        # Rezerwacje w tych samych magazynach co kolumna „Stan” (wybrany albo wszystkie z katalogu).
        reserved = StockItem.where(account: Current.account, product_id: products.flat_map { [ _1.id, *_1.variants.map(&:id) ] },
          warehouse_id: warehouse ? warehouse.id : warehouses.map(&:id)).group(:product_id).sum(:reserved)
        # Cena do pola edycji z listy - tylko produkty sprzedawalne (prosty, wariant).
        price_input = ->(product) { Inventory.format_money_input(product.price_cents_in(group.id)) }

        products.map do |product|
          variants = product.variants.to_a
          own_prices = variants.any? ? variants.map { _1.price_cents_in(group.id) } : [ product.price_cents_in(group.id) ]
          {
            id: product.id, name: product.name, sku: product.sku, ean: product.ean, status: product.status,
            image: product.images.first&.then { rails_representation_path(_1.file.variant(:thumb)) },
            price: price_label.(own_prices), stock: product.stock_value.to_i, sellable: variants.none?,
            reserved: variants.any? ? variants.sum { reserved.fetch(_1.id, 0) } : reserved.fetch(product.id, 0),
            priceInput: variants.any? ? nil : price_input.(product),
            variants: variants.map do |variant|
              { id: variant.id, name: variant.name, sku: variant.sku, ean: variant.ean,
                price: price_label.([ variant.price_cents_in(group.id) ]), stock: variant_stock.fetch(variant.id), sellable: true,
                reserved: reserved.fetch(variant.id, 0), priceInput: price_input.(variant) }
            end
          }
        end
      end

      # Wizyta z samej listy (filtry, sortowanie, strona, powrót po zmianie ceny/stanu z listy) - tabela jest już na ekranie,
      # więc produkty idą w tej samej odpowiedzi (bez skeletonu i bez znikania wierszy, tylko przygaszenie na froncie).
      def from_list?
        request.inertia? && request.referer.present? && URI(request.referer).path == request.path
      rescue URI::InvalidURIError
        false
      end

      def view_cookie = "inventory_products_view_#{Current.account.id}"

      # Parametry widoku, których nie ma w adresie, bierzemy z zapamiętanego widoku - serwer od razu renderuje właściwy
      # widok (bez drugiego zapytania z przeglądarki). Adres ma pierwszeństwo.
      def restore_view
        saved = cookies.signed[view_cookie]
        return unless saved.is_a?(Hash)

        saved = saved.slice(*VIEW_KEYS)
        saved.delete("catalog_id") unless catalogs.exists?(id: saved["catalog_id"])
        # Magazyn i grupa cenowa należą do katalogu - po przejściu do innego katalogu zostają domyślne.
        saved = saved.except("warehouse_id", "price_group_id") if params[:catalog_id].present? && params[:catalog_id].to_s != saved["catalog_id"].to_s
        saved.each { |key, value| params[key] = value unless params.key?(key) }
      end

      # „Wszystkie magazyny” zapisujemy jawnie, żeby nie przywrócić przy następnym wejściu wcześniej wybranego magazynu.
      def remember_view(search, warehouse, group)
        cookies.permanent.signed[view_cookie] = {
          value: { "catalog_id" => current_catalog.id, "warehouse_id" => warehouse&.id || ALL_WAREHOUSES, "price_group_id" => group.id,
                   "sort" => search.sort, "dir" => search.direction, "per" => search.per },
          httponly: true, same_site: :lax
        }
      end

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

      def products_word(count)
        return "produkt" if count == 1
        return "produkty" if (2..4).cover?(count % 10) && !(12..14).cover?(count % 100)

        "produktów"
      end

      def set_product
        @product = Product.where(account: Current.account).includes(:prices, :parent, variants: :prices).find(params[:id])
      end

      # Zakładka karty, na którą wracamy po zapisie (?tab=sales itd.).
      def tab = params[:tab].presence

      # Produkt i stan (`stock`) w jednej transakcji - błąd w którymkolwiek nie zapisuje niczego.
      def save(product, notice:, redirect_tab: tab)
        product.assign_attributes(product_params(product))
        stock_errors = {}
        Product.transaction do
          raise ActiveRecord::Rollback unless product.save

          stock_errors = apply_stock(product, params[:stock])
          raise ActiveRecord::Rollback if stock_errors.any?
        end

        if product.errors.none? && stock_errors.none?
          redirect_to edit_inventory_product_path(product, tab: redirect_tab), notice:
        else
          target = product.persisted? ? edit_inventory_product_path(product, tab:) : new_inventory_product_path(catalog_id: product.catalog_id, tab:)
          redirect_to target, inertia: { errors: inertia_errors(product).merge(stock_errors) }
        end
      end

      def product_params(product)
        permitted = params.expect(product: CARD_PARAMS)
        if product.persisted? && product.with_variants?
          permitted.delete(:price_inputs)
        elsif permitted.key?(:price_inputs)
          permitted[:price_inputs] = catalog_price_inputs(permitted[:price_inputs], product.catalog)
        end
        permitted
      end

      def form_props(product)
        {
          product: card_json(product),
          catalog: { id: product.catalog.id, name: product.catalog.name },
          catalogs: catalogs_json,
          categories: categories_json(product.persisted? ? product.catalog : nil),
          # Formularz pokazuje ceny tylko w grupach katalogu produktu (przy nowym produkcie - wybranego katalogu).
          priceGroups: price_groups_json,
          catalogPriceGroups: catalogs.includes(:catalog_price_groups).to_h { [ _1.id.to_s, _1.price_group_ids ] },
          statuses: STATUS_LABELS,
          taxRates: Product::TAX_RATES.map(&:to_s)
        }
      end
  end
end
