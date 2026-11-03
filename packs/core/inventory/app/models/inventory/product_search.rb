module Inventory
  # Lista produktów katalogu (produkty główne): wyszukiwanie, filtry, sortowanie i stronicowanie.
  #
  # FILTERS opisują też pola formularza - frontend rysuje je i chipy ze `schema`. Typy:
  #   :text        - parametr `key`, „zawiera”
  #   :select      - parametr `key`, wartość z `options`
  #   :range       - parametry `key_min` / `key_max`, liczby całkowite
  #   :money_range - parametry `key_min` / `key_max`, kwoty („99,90”) w groszach
  #
  # Produkt wariantowy pasuje, gdy pasuje on albo którykolwiek wariant; stan i cena liczone są dla całej
  # rodziny (scope'y w Product).
  class ProductSearch
    Filter = Data.define(:key, :label, :type, :options, :unit) do
      def initialize(key:, label:, type:, options: nil, unit: nil) = super

      def range? = type.in?(%i[range money_range])
      def money? = type == :money_range
      def params = range? ? [ "#{key}_min", "#{key}_max" ] : [ key ]

      def schema
        { key:, label:, type:, params:, options: options&.map { |value, label| { value:, label: } }, unit: }.compact
      end
    end

    FILTERS = [
      Filter.new(key: "sku", label: "SKU", type: :text),
      Filter.new(key: "ean", label: "EAN", type: :text),
      Filter.new(key: "price", label: "Cena", type: :money_range, unit: :currency),
      Filter.new(key: "stock", label: "Stan", type: :range, unit: "szt."),
      Filter.new(key: "status", label: "Status", type: :select, options: Product::STATUS_LABELS),
      Filter.new(key: "kind", label: "Typ", type: :select, options: { "simple" => "Prosty", "variants" => "Z wariantami" })
    ].freeze

    SORT_COLUMNS = {
      "name" => "LOWER(inventory_products.name)", "sku" => "inventory_products.sku", "price" => "family_price.min",
      "stock" => "family_stock.value", "created_at" => "inventory_products.created_at"
    }.freeze
    PER_PAGE = [ 25, 50, 100 ].freeze

    attr_reader :query, :values, :sort, :direction, :price_group

    def initialize(account:, catalog:, warehouse_ids:, price_group:, params:)
      @account, @catalog, @warehouse_ids, @price_group, @params = account, catalog, warehouse_ids, price_group, params
      @query = params[:q].to_s.strip
      @values = FILTERS.to_h { [ _1.key, parse(_1) ] }.compact
      @sort = SORT_COLUMNS.key?(params[:sort]) ? params[:sort] : "name"
      @direction = params[:dir] == "desc" ? "desc" : "asc"
    end

    def schema = FILTERS.map(&:schema)

    # Bieżąca strona; strona spoza zakresu (np. po usunięciu produktów) → ostatnia.
    def pagy
      @pagy ||= begin
        limit = PER_PAGE.include?(@params[:per].to_i) ? @params[:per].to_i : 50
        count = scope.count(:all)
        pagy = Pagy::Offset.new(count:, limit:, page: [ @params[:page].to_i, 1 ].max)
        pagy.page > pagy.last ? Pagy::Offset.new(count:, limit:, page: pagy.last) : pagy
      end
    end

    # Produkty bieżącej strony z wariantami i cenami (`stock_value`, `min_price` - patrz Product.with_family_metrics).
    def records
      @records ||= pagy.records(scope.order(Arel.sql("#{SORT_COLUMNS.fetch(sort)} #{direction} NULLS LAST"), :id))
        .includes(:prices, variants: :prices).to_a
    end

    # Id wszystkich pasujących produktów (akcje masowe na „wszystkich stronach”).
    def ids = scope.pluck(:id)

    # Wartości filtrów do formularza: { "sku" => "LENA", "price_min" => "99,90", "price_max" => "", … }.
    def param_values
      FILTERS.each_with_object({}) do |filter, result|
        value = values[filter.key]
        if filter.range?
          result["#{filter.key}_min"] = format_bound(filter, value&.begin)
          result["#{filter.key}_max"] = format_bound(filter, value&.end)
        else
          result[filter.key] = value.to_s
        end
      end
    end

    private
      def scope
        @scope ||= values.reduce(base_scope) { |scope, (key, value)| apply(scope, key, value) }
      end

      def base_scope
        scope = Product.main.where(account: @account, catalog: @catalog)
          .with_family_metrics(warehouse_ids: @warehouse_ids, price_group:)
        query.present? ? scope.matching(:name, query) : scope
      end

      def apply(scope, key, value)
        case key
        when "sku", "ean" then scope.matching(key, value)
        when "price" then scope.priced_between(price_group, value)
        when "stock" then scope.stocked_between(value)
        when "status" then scope.where(status: value)
        when "kind" then value == "variants" ? scope.with_variants : scope.without_variants
        end
      end

      # Wartość filtru z parametrów albo nil (pusty / nieprawidłowy). Zakresy jako Range z otwartymi końcami.
      def parse(filter)
        raw = @params[filter.key].to_s.strip
        case filter.type
        when :text then raw.presence
        when :select then raw if filter.options.key?(raw)
        else
          min, max = %w[min max].map { parse_number(filter, @params["#{filter.key}_#{_1}"]) }
          (min..max) if min || max
        end
      end

      def parse_number(filter, raw)
        return if raw.blank?

        filter.money? ? Inventory.parse_money(raw) : Integer(raw.to_s.strip, 10, exception: false)
      end

      def format_bound(filter, value)
        (filter.money? ? Inventory.format_money_input(value) : value).to_s
      end
  end
end
