module Orders
  # Lista zamówień ze wszystkich źródeł (Live, Allegro, sklepy, ręczne) i karta zamówienia.
  class OrdersController < BaseController
    # Zapamiętany sposób wyświetlania listy (cookie, osobno dla konta). Status, filtry, wyszukiwanie i strona - nie.
    VIEW_KEYS = %w[sort dir per].freeze
    # Parametry listy, które karta zamówienia przenosi dalej (strzałki, powrót): status, wyszukiwanie, filtry, sortowanie.
    LIST_PARAMS = %w[q status group sort dir source payment shipping total_min total_max].freeze
    ADDRESS_NOTICES = { "shipping" => "Zapisano adres dostawy.", "billing" => "Zapisano dane do faktury.", "pickup" => "Zapisano punkt odbioru." }.freeze

    before_action :set_order, only: %i[show update change_status payment shipping address customer fields]
    before_action :restore_view, only: %i[index show]

    # Lista: status albo grupa z listy po lewej, wyszukiwanie, filtry z OrderSearch, sortowanie, strony.
    # Przy wejściu na listę zamówienia i stronicowanie dochodzą osobnym zapytaniem (deferred) - do tego czasu skeleton.
    def index
      search = OrderSearch.new(account: Current.account, params:)
      remember_view(search)
      list = ->(block) { from_list? ? block : InertiaRails.defer(group: "list", &block) }
      counts = Order.where(account: Current.account).group(:status_id).count

      render inertia: "core/orders/index", props: {
        orders: list.(-> { search.records.map { order_row(_1) } }),
        pagination: list.(-> { { page: search.pagy.page, pages: search.pagy.pages, per: search.pagy.limit, total: search.pagy.count } }),
        statusTree: status_tree(counts:),
        totalCount: counts.values.sum,
        filterSchema: search.schema,
        filters: search.param_values,
        view: { q: search.query, status: search.status_id, group: search.group_id, sort: search.sort, dir: search.direction, per: search.per },
        # Parametry listy przekazywane do karty zamówienia (strzałki poprzednie / następne i powrót do tej samej listy).
        listQuery: list_query
      }
    end

    # POST /orders/bulk  operation=status&status_id=… - na zaznaczonych (`ids[]`) albo wszystkich pasujących
    # (`all=true` + parametry listy, bez `excluded_ids[]`).
    def bulk
      all = ActiveModel::Type::Boolean.new.cast(params[:all])
      ids = all ? OrderSearch.new(account: Current.account, params:).ids - Array(params[:excluded_ids]).map(&:to_i) : Array(params[:ids]).map(&:to_i)
      return redirect_back_or_to(orders_path, alert: "Nie zaznaczono zamówień.") if ids.empty?
      return redirect_back_or_to(orders_path, alert: "Nieznana akcja.") unless params[:operation] == "status"

      status = Status.where(account: Current.account).find_by(id: params[:status_id])
      return redirect_back_or_to(orders_path, alert: "Nieznany status.") unless status

      count = Orders.change_statuses!(Current.account, ids, status, user: Current.user)
      redirect_back_or_to orders_path, notice: "Zmieniono status #{count} #{orders_word(count)} na „#{status.name}”."
    end

    # Karta zamówienia. Parametry listy, z której przyszliśmy (status, wyszukiwanie, filtry, sortowanie), wyznaczają
    # poprzednie i następne zamówienie oraz adres powrotu.
    def show
      previous_id, next_id = OrderSearch.new(account: Current.account, params:).neighbors(@order.id)
      query = list_query
      with_query = ->(path) { query.present? ? "#{path}?#{query}" : path }
      render inertia: "core/orders/show", props: {
        order: order_json(@order),
        statusTree: status_tree,
        customFields: Orders.custom_fields(Current.account).map { { id: _1.id, name: _1.name, kind: _1.kind, options: _1.options } },
        # Podpowiedzi w polu „Sposób dostawy”: sposoby użyte już w zamówieniach konta.
        shippingMethods: Orders.shipping_methods(Current.account),
        navigation: {
          list: with_query.(orders_path),
          previous: previous_id && with_query.(order_path(previous_id)),
          next: next_id && with_query.(order_path(next_id))
        }
      }
    end

    # PATCH /orders/:id  notes=… - notatka wewnętrzna.
    def update
      Orders.update_notes!(@order, params[:notes])
      redirect_back_or_to order_path(@order), notice: "Zapisano notatkę."
    end

    # PATCH /orders/:id/status  status_id=…&note=…
    def change_status
      status = Status.where(account: Current.account).find(params[:status_id])
      Orders.change_status!(@order, status, user: Current.user, note: params[:note])
      redirect_back_or_to order_path(@order), notice: "Zmieniono status na „#{status.name}”."
    end

    # PATCH /orders/:id/payment  paid=281,99&payment_method=transfer|online|cod|cash
    def payment
      Orders.update_payment!(@order, paid_cents: Inventory.parse_money(params[:paid]),
        payment_method: params.key?(:payment_method) ? params[:payment_method].to_s : @order.payment_method)
      redirect_back_or_to order_path(@order), notice: "Zapisano płatność: #{PAYMENT_STATUS_LABELS.fetch(@order.payment_status).downcase}."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    # PATCH /orders/:id/shipping  method=InPost Paczkomat&price=14,99
    def shipping
      Orders.update_shipping!(@order, method: params[:method], price_cents: Inventory.parse_money(params[:price]))
      redirect_back_or_to order_path(@order), notice: "Zapisano dostawę."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    # PATCH /orders/:id/address  kind=shipping|billing|pickup&address[…] (+ wants_invoice przy danych do faktury)
    def address
      kind = params[:kind].to_s
      return redirect_back_or_to(order_path(@order), alert: "Nieznany rodzaj adresu.") unless ADDRESS_FIELDS.key?(kind)

      wants_invoice = ActiveModel::Type::Boolean.new.cast(params[:wants_invoice]) if kind == "billing" && params.key?(:wants_invoice)
      Orders.update_address!(@order, kind, params.fetch(:address, {}).permit(*ADDRESS_FIELDS[kind]), wants_invoice:)
      redirect_back_or_to order_path(@order), notice: ADDRESS_NOTICES.fetch(kind)
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    # PATCH /orders/:id/customer  name=…&email=…&phone=… - dane kontaktowe klienta w zamówieniu.
    def customer
      Orders.update_customer!(@order, name: params[:name], email: params[:email], phone: params[:phone])
      redirect_back_or_to order_path(@order), notice: "Zapisano dane klienta."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    # PATCH /orders/:id/fields  values[<id pola>]=… - pola dodatkowe.
    def fields
      Orders.update_custom_fields!(@order, params.fetch(:values, {}).permit!.to_h)
      redirect_back_or_to order_path(@order), notice: "Zapisano pola dodatkowe."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors.transform_keys { "values.#{_1}" } }
    end

    private
      def set_order
        @order = Order.where(account: Current.account).includes(:items, :status, :status_changes).find(params[:id])
      end

      def status_json(status) = { id: status.id, name: status.name, color: status.color }

      def payment_json(order)
        money = ->(cents) { Orders.format_money(cents, order.currency) }
        {
          status: order.payment_status, method: order.payment_method, cod: order.cod_pending?,
          label: PAYMENT_STATUS_LABELS.fetch(order.payment_status), methodLabel: PAYMENT_METHOD_LABELS[order.payment_method],
          paid: money.(order.paid_cents), total: money.(order.total_cents),
          remaining: money.(order.remaining_cents), overpaid: money.(order.overpaid_cents),
          paidInput: Inventory.format_money_input(order.paid_cents), totalInput: Inventory.format_money_input(order.total_cents)
        }
      end

      def order_row(order)
        items = order.items.to_a
        {
          id: order.id, number: order.number, placed_at: order.placed_at.iso8601,
          source: SOURCE_LABELS.fetch(order.source), source_channel: order.source_channel,
          customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
          items: { count: items.sum(&:quantity), first: items.first&.name, more: [ items.size - 1, 0 ].max },
          total: Orders.format_money(order.total_cents, order.currency),
          payment: payment_json(order),
          status: status_json(order.status)
        }
      end

      def order_json(order)
        product_ids = order.items.filter_map(&:product_id)
        products = Inventory.find_products(Current.account, ids: product_ids).index_by(&:id)
        images = Inventory.main_images(Current.account, product_ids)
        users = User.where(id: order.status_changes.filter_map(&:user_id)).pluck(:id, :name).to_h
        statuses = Status.where(account: Current.account).index_by(&:id)
        money = ->(cents) { Orders.format_money(cents, order.currency) }

        {
          id: order.id, number: order.number, placed_at: order.placed_at.iso8601,
          source: SOURCE_LABELS.fetch(order.source), source_channel: order.source_channel, external_id: order.external_id,
          warehouse: order.warehouse_id && Inventory.warehouses(Current.account).find_by(id: order.warehouse_id)&.name,
          # Stan towaru w magazynie - tylko gdy zamówienie ma produkty z katalogu.
          stock: product_ids.any? ? Inventory.stock_state(order).then { { state: _1, label: STOCK_STATE_LABELS.fetch(_1) } } : nil,
          status: status_json(order.status),
          payment: payment_json(order),
          customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
          shipping_method: order.shipping_method,
          addresses: { shipping: order.shipping_address, billing: order.billing_address, pickup: order.pickup_point },
          wants_invoice: order.wants_invoice,
          custom_fields: order.custom_fields,
          notes: order.notes.to_s,
          customer_message: order.customer_message,
          status_since: (order.status_changes.last&.created_at || order.placed_at).iso8601,
          totals: { subtotal: money.(order.subtotal_cents), shipping: money.(order.shipping_cents), total: money.(order.total_cents),
                    quantity: order.items.sum(&:quantity), shippingInput: Inventory.format_money_input(order.shipping_cents) },
          items: order.items.map do |item|
            product = products[item.product_id]
            {
              id: item.id, name: item.name, sku: item.sku, quantity: item.quantity, tax_rate: item.tax_rate.to_i,
              unit_price: money.(item.unit_price_cents), total: money.(item.total_cents),
              unitPriceInput: Inventory.format_money_input(item.unit_price_cents), catalog: item.product_id.present?,
              image: images[item.product_id]&.then { rails_representation_path(_1.variant(:thumb)) },
              href: product && (product.parent_id ? "/inventory/variants/#{product.id}/edit" : "/inventory/products/#{product.id}/edit")
            }
          end,
          history: order.status_changes.reverse.map do |change|
            {
              id: change.id, created_at: change.created_at.iso8601, user: users[change.user_id], note: change.note,
              from: change.from_status && { name: change.from_status, color: statuses[change.from_status_id]&.color || "gray" },
              to: { name: change.to_status, color: statuses[change.to_status_id]&.color || "gray" }
            }
          end
        }
      end

      # Wizyta z samej listy (status, filtry, sortowanie, strona) - tabela jest już na ekranie, więc zamówienia idą
      # w tej samej odpowiedzi (bez skeletonu, tylko przygaszenie na froncie).
      def from_list?
        request.inertia? && request.referer.present? && URI(request.referer).path == request.path
      rescue URI::InvalidURIError
        false
      end

      def view_cookie = "orders_view_#{Current.account.id}"

      # Parametry listy z adresu (bez strony i liczby na stronę) jako query string.
      def list_query = request.query_parameters.slice(*LIST_PARAMS).compact_blank.to_query

      def restore_view
        saved = cookies.signed[view_cookie]
        return unless saved.is_a?(Hash)

        saved.slice(*VIEW_KEYS).each { |key, value| params[key] = value unless params.key?(key) }
      end

      def remember_view(search)
        cookies.permanent.signed[view_cookie] = {
          value: { "sort" => search.sort, "dir" => search.direction, "per" => search.per }, httponly: true, same_site: :lax
        }
      end

      # Dopełniacz po „status …”: 1 zamówienia, 2 / 5 zamówień.
      def orders_word(count) = count == 1 ? "zamówienia" : "zamówień"
  end
end
