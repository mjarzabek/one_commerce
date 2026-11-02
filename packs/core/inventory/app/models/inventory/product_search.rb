module Inventory
  # Wyszukiwanie, filtry, sortowanie i stronicowanie listy produktów katalogu (produkty główne).
  #
  # Filtry są deklaratywne (FILTERS): klucz, etykieta, typ i warunek SQL. Frontend rysuje pola i chipy
  # na podstawie `schema`, więc nowy filtr to jeden wpis tutaj. Typy:
  #   :text        – jeden parametr `key`, „zawiera”
  #   :select      – jeden parametr `key`, wartość z `options`
  #   :range       – parametry `key_min` / `key_max`, liczby całkowite
  #   :money_range – parametry `key_min` / `key_max`, kwoty („99,90”) zamieniane na grosze
  #
  # Dla produktu wariantowego tekst i cena pasują, gdy pasuje produkt główny albo którykolwiek wariant;
  # stan to suma wariantów w wybranych magazynach.
  class ProductSearch
    Filter = Data.define(:key, :label, :type, :options, :unit, :apply) do
      def params = type.in?(%i[range money_range]) ? [ "#{key}_min", "#{key}_max" ] : [ key ]

      def schema
        { key:, label:, type:, params:, options: options&.map { |value, label| { value:, label: } }, unit: }.compact
      end
    end

    # Produkt główny i jego warianty w podzapytaniach („sp” = produkt sprzedawalny z rodziny).
    FAMILY = "(sp.id = inventory_products.id OR sp.parent_id = inventory_products.id)"
    HAS_VARIANTS = "EXISTS (SELECT 1 FROM inventory_products v WHERE v.parent_id = inventory_products.id)"

    # Tekst pasuje do produktu głównego albo któregokolwiek wariantu.
    MATCH = %w[name sku ean].to_h do |column|
      [ column, "inventory_products.#{column} ILIKE :pattern OR EXISTS (SELECT 1 FROM inventory_products v " \
                "WHERE v.parent_id = inventory_products.id AND v.#{column} ILIKE :pattern)" ]
    end.freeze

    # Wartości zawsze przez parametry: :warehouses, :group, :min, :max.
    STOCK = "(SELECT COALESCE(SUM(si.on_hand - si.reserved), 0) FROM inventory_stock_items si " \
            "JOIN inventory_products sp ON sp.id = si.product_id WHERE #{FAMILY} AND si.warehouse_id IN (:warehouses))"
    MIN_PRICE = "(SELECT MIN(pr.amount_cents) FROM inventory_prices pr JOIN inventory_products sp ON sp.id = pr.product_id " \
                "WHERE #{FAMILY} AND pr.price_group_id = :group)"
    PRICE_IN_RANGE = "EXISTS (SELECT 1 FROM inventory_prices pr JOIN inventory_products sp ON sp.id = pr.product_id " \
                     "WHERE #{FAMILY} AND pr.price_group_id = :group " \
                     "AND (CAST(:min AS integer) IS NULL OR pr.amount_cents >= :min) " \
                     "AND (CAST(:max AS integer) IS NULL OR pr.amount_cents <= :max))"
    STOCK_IN_RANGE = "(CAST(:min AS integer) IS NULL OR #{STOCK} >= :min) AND (CAST(:max AS integer) IS NULL OR #{STOCK} <= :max)"

    FILTERS = [
      Filter.new(key: "sku", label: "SKU", type: :text, options: nil, unit: nil,
        apply: ->(scope, value, _) { scope.where(MATCH["sku"], pattern: ProductSearch.like(value)) }),
      Filter.new(key: "ean", label: "EAN", type: :text, options: nil, unit: nil,
        apply: ->(scope, value, _) { scope.where(MATCH["ean"], pattern: ProductSearch.like(value)) }),
      Filter.new(key: "price", label: "Cena", type: :money_range, options: nil, unit: :currency,
        apply: ->(scope, range, search) { scope.where(PRICE_IN_RANGE, group: search.price_group.id, **range) }),
      Filter.new(key: "stock", label: "Stan", type: :range, options: nil, unit: "szt.",
        apply: ->(scope, range, search) { scope.where(STOCK_IN_RANGE, warehouses: search.warehouses, **range) }),
      Filter.new(key: "status", label: "Status", type: :select, options: Product::STATUS_LABELS, unit: nil,
        apply: ->(scope, value, _) { scope.where(status: value) }),
      Filter.new(key: "kind", label: "Typ", type: :select, options: { "simple" => "Prosty", "variants" => "Z wariantami" }, unit: nil,
        apply: ->(scope, value, _) { value == "variants" ? scope.where(HAS_VARIANTS) : scope.where.not(HAS_VARIANTS) })
    ].freeze

    SORT_COLUMNS = {
      "name" => "LOWER(inventory_products.name)", "sku" => "inventory_products.sku", "price" => MIN_PRICE,
      "stock" => STOCK, "created_at" => "inventory_products.created_at"
    }.freeze
    PER_PAGE = [ 25, 50, 100 ].freeze

    def self.like(value) = "%#{ActiveRecord::Base.sanitize_sql_like(value)}%"

    attr_reader :query, :values, :page, :per, :sort, :direction, :price_group

    def initialize(account:, catalog:, warehouse_ids:, price_group:, params:)
      @account, @catalog, @warehouse_ids, @price_group = account, catalog, warehouse_ids.map(&:to_i), price_group
      @query = params[:q].to_s.strip
      @values = FILTERS.to_h { [ _1.key, parse(_1, params) ] }.compact
      @sort = SORT_COLUMNS.key?(params[:sort]) ? params[:sort] : "name"
      @direction = params[:dir] == "desc" ? "desc" : "asc"
      @per = PER_PAGE.include?(params[:per].to_i) ? params[:per].to_i : 50
      @page = [ params[:page].to_i, 1 ].max
    end

    def schema
      FILTERS.map(&:schema)
    end

    def warehouses = @warehouse_ids.presence || [ 0 ]

    def total
      @total ||= scope.count
    end

    def pages
      [ (total.to_f / per).ceil, 1 ].max
    end

    def current_page = page.clamp(1, pages)

    # Id wszystkich pasujących produktów (akcje masowe na „wszystkich stronach”).
    def ids
      scope.pluck(:id)
    end

    # Produkty bieżącej strony z wariantami i cenami; `stock_value` = stan w wybranych magazynach.
    def records
      @records ||= scope
        .select(sql("inventory_products.*, #{STOCK} AS stock_value"))
        .order(Arel.sql(sql("#{SORT_COLUMNS.fetch(sort)} #{direction == "desc" ? "DESC" : "ASC"} NULLS LAST")), :id)
        .limit(per).offset((current_page - 1) * per)
        .includes(:prices, variants: :prices).to_a
    end

    # Wartości parametrów filtrów do formularza: { "sku" => "LENA", "price_min" => "99,90", … }.
    def param_values
      FILTERS.each_with_object({}) do |filter, result|
        value = values[filter.key]
        case filter.type
        when :range, :money_range
          format = filter.type == :money_range ? ->(v) { v && Kernel.format("%.2f", v / 100.0).tr(".", ",") } : ->(v) { v&.to_s }
          result["#{filter.key}_min"] = format.(value&.dig(:min)).to_s
          result["#{filter.key}_max"] = format.(value&.dig(:max)).to_s
        else
          result[filter.key] = value.to_s
        end
      end
    end

    private
      def scope
        @scope ||= begin
          s = Product.main.where(account: @account, catalog: @catalog)
          s = s.where(MATCH["name"], pattern: self.class.like(query)) if query.present?
          FILTERS.reduce(s) { |current, filter| values.key?(filter.key) ? filter.apply.(current, values[filter.key], self) : current }
        end
      end

      def parse(filter, params)
        case filter.type
        when :text then params[filter.key].to_s.strip.presence
        when :select then filter.options.key?(params[filter.key].to_s) ? params[filter.key].to_s : nil
        when :range, :money_range
          read = filter.type == :money_range ? ->(v) { Inventory.parse_money(v) } : ->(v) { Integer(v.to_s.strip, 10, exception: false) }
          min, max = %w[min max].map { |suffix| (raw = params["#{filter.key}_#{suffix}"]).present? ? read.(raw) : nil }
          { min:, max: } if min || max
        end
      end

      def sql(fragment)
        Product.sanitize_sql_array([ fragment, { warehouses:, group: price_group.id } ])
      end
  end
end
