module Orders
  # Lista zamówień w panelu: status albo grupa statusów (lista po lewej), wyszukiwanie, filtry, sortowanie i strony.
  #
  # FILTERS opisują też pola formularza - frontend rysuje je i chipy ze `schema` (typy jak w Inventory::ProductSearch):
  #   :select      - parametr `key`, wartość z `options`
  #   :money_range - parametry `key_min` / `key_max`, kwoty („99,90”) w groszach
  class OrderSearch
    Filter = Data.define(:key, :label, :type, :options, :unit) do
      def initialize(key:, label:, type:, options: nil, unit: nil) = super

      def range? = type == :money_range
      def params = range? ? [ "#{key}_min", "#{key}_max" ] : [ key ]

      def schema
        { key:, label:, type:, params:, options: options&.map { |value, label| { value:, label: } }, unit: }.compact
      end
    end

    # Filtr „Płatność”: status płatności, a pobranie osobno (nic nie wpłacono, ale klient płaci kurierowi).
    PAYMENT_OPTIONS = {
      "unpaid" => "Nieopłacone", "partial" => "Częściowo", "paid" => "Opłacone", "overpaid" => "Nadpłata", "cod" => "Za pobraniem"
    }.freeze

    SORT_COLUMNS = {
      "placed_at" => "orders_orders.placed_at", "number" => "orders_orders.number",
      "customer" => "LOWER(orders_orders.customer_name)", "total" => "orders_orders.total_cents"
    }.freeze
    PER_PAGE = [ 25, 50, 100 ].freeze

    attr_reader :query, :values, :sort, :direction, :status_id, :group_id

    def initialize(account:, params:)
      @account, @params = account, params
      @query = params[:q].to_s.strip
      @status_id = Status.where(account:).where(id: params[:status].to_s.to_i).pick(:id) if params[:status].present?
      @group_id = StatusGroup.where(account:).where(id: params[:group].to_s.to_i).pick(:id) if params[:group].present? && !@status_id
      @values = filters.to_h { [ _1.key, parse(_1) ] }.compact
      @sort = SORT_COLUMNS.key?(params[:sort]) ? params[:sort] : "placed_at"
      @direction = params[:dir] == "asc" ? "asc" : "desc"
    end

    def filters
      @filters ||= [
        Filter.new(key: "source", label: "Źródło", type: :select, options: SOURCE_LABELS),
        Filter.new(key: "payment", label: "Płatność", type: :select, options: PAYMENT_OPTIONS),
        Filter.new(key: "shipping", label: "Dostawa", type: :select, options: shipping_methods.index_by(&:itself)),
        Filter.new(key: "total", label: "Wartość", type: :money_range, unit: "PLN")
      ]
    end

    def schema = filters.map(&:schema)

    def per = PER_PAGE.include?(@params[:per].to_i) ? @params[:per].to_i : 50

    # Bieżąca strona; strona spoza zakresu (np. po zmianie statusów) → ostatnia.
    def pagy
      @pagy ||= begin
        count = scope.count(:all)
        pagy = Pagy::Offset.new(count:, limit: per, page: [ @params[:page].to_i, 1 ].max)
        pagy.page > pagy.last ? Pagy::Offset.new(count:, limit: per, page: pagy.last) : pagy
      end
    end

    def records
      @records ||= pagy.records(scope.order(Arel.sql("#{SORT_COLUMNS.fetch(sort)} #{direction} NULLS LAST"), id: direction))
        .includes(:items, :status).to_a
    end

    # Id wszystkich pasujących zamówień (akcje masowe na „wszystkich stronach”).
    def ids = scope.pluck(:id)

    # Poprzednie i następne zamówienie na liście (w jej kolejności) - strzałki na karcie zamówienia. [nil, nil], gdy
    # zamówienia nie ma na liście (np. zmieniło status).
    def neighbors(id)
      ids = scope.order(Arel.sql("#{SORT_COLUMNS.fetch(sort)} #{direction} NULLS LAST"), id: direction).pluck(:id)
      index = ids.index(id)
      return [ nil, nil ] unless index

      [ index.positive? ? ids[index - 1] : nil, ids[index + 1] ]
    end

    def param_values
      filters.each_with_object({}) do |filter, result|
        value = values[filter.key]
        if filter.range?
          result["#{filter.key}_min"] = Inventory.format_money_input(value&.begin).to_s
          result["#{filter.key}_max"] = Inventory.format_money_input(value&.end).to_s
        else
          result[filter.key] = value.to_s
        end
      end
    end

    private
      def shipping_methods
        @shipping_methods ||= Orders.shipping_methods(@account)
      end

      def scope
        @scope ||= values.reduce(base_scope) { |scope, (key, value)| apply(scope, key, value) }
      end

      def base_scope
        scope = Order.where(account: @account)
        scope = scope.where(status_id:) if status_id
        scope = scope.where(status_id: Status.where(group_id:).select(:id)) if group_id
        query.present? ? search(scope) : scope
      end

      def search(scope)
        pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
        digits = query.gsub(/\D/, "")
        conditions = %w[number customer_name customer_email external_id].map { "orders_orders.#{_1} ILIKE :pattern" }
        conditions << "regexp_replace(orders_orders.customer_phone, '\\D', '', 'g') LIKE :digits" if digits.length >= 3
        scope.where(conditions.join(" OR "), pattern:, digits: "%#{digits}%")
      end

      def apply(scope, key, value)
        case key
        when "source" then scope.where(source: value)
        when "payment" then payment(scope, value)
        when "shipping" then scope.where(shipping_method: value)
        when "total" then scope.where(total_cents: value)
        end
      end

      # Nieopłacone za pobraniem to osobna pozycja filtra; opłacone pobranie (po doręczeniu) jest wśród opłaconych.
      def payment(scope, value)
        case value
        when "cod" then scope.where(payment_method: "cod", payment_status: "unpaid")
        when "unpaid" then scope.where(payment_status: "unpaid").where("orders_orders.payment_method IS DISTINCT FROM 'cod'")
        else scope.where(payment_status: value)
        end
      end

      def parse(filter)
        raw = @params[filter.key].to_s.strip
        if filter.range?
          min, max = %w[min max].map { Inventory.parse_money(@params["#{filter.key}_#{_1}"]) if @params["#{filter.key}_#{_1}"].present? }
          (min..max) if min || max
        else
          raw if filter.options.key?(raw)
        end
      end
  end
end
