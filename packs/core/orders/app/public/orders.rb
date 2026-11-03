# Publiczne API panelu zamówień. Moduły tworzą i zmieniają zamówienia wyłącznie przez te metody.
#
#   Orders.create_from(account:, source: :live, external_id: "cart-42",
#     customer: { channel: "facebook", external_id: "1234", name: "Anna Kowalska" },
#     items: [ { product_id: 7, quantity: 2 } ],
#     shipping: { method: "InPost Paczkomat", price_cents: 1_499 })
module Orders
  def self.table_name_prefix = "orders_"

  STATUSES = Order::TRANSITIONS.keys.freeze
  SOURCES = Order.sources.keys.freeze

  STATUS_LABELS = {
    "new" => "Nowe", "confirmed" => "Potwierdzone", "paid" => "Opłacone", "processing" => "W realizacji",
    "shipped" => "Wysłane", "delivered" => "Dostarczone", "cancelled" => "Anulowane", "returned" => "Zwrócone"
  }.freeze
  SOURCE_LABELS = { "live" => "Live", "multichannel" => "E-commerce", "manual" => "Ręczne", "api" => "API" }.freeze

  # Które ustawienie rezerwacji z Inventory (live / ecommerce / manual) obowiązuje dane źródło zamówienia.
  RESERVATION_SOURCE = { "live" => "live", "multichannel" => "ecommerce", "manual" => "manual", "api" => "manual" }.freeze

  class InvalidTransition < StandardError; end

  module_function

  # Tworzy zamówienie z pozycjami i rezerwuje towar - wszystko albo nic.
  #
  # items:    [{ product_id:, quantity:, unit_price_cents: (opcjonalnie, domyślnie cena z grupy cenowej) }]
  #           - produkt prosty albo wariant (nie produkt główny wariantowy)
  #           albo pozycja spoza katalogu: [{ sku:, name:, quantity:, unit_price_cents:, tax_rate: }]
  # customer: { channel:, external_id:, handle:, name:, email:, phone: } - z tożsamością w kanale
  #           albo { name:, email:, phone: } - zamówienie ręczne; nil - bez klienta.
  #
  # Ceny i waluta pochodzą z `price_group` (domyślnie: domyślna grupa katalogu zamawianych produktów).
  # Zamówienie realizowane jest z jednego magazynu: `warehouse_id` albo magazynu ustawionego dla źródła
  # (Produkty › Ustawienia › Ogólne › Źródła zamówień). Towar jest rezerwowany od razu, jeśli źródło ma włączone rezerwacje -
  # wtedy przy braku towaru w tym magazynie rzuca Inventory::InsufficientStock. Bez rezerwacji towar schodzi
  # ze stanu dopiero przy wysyłce.
  #
  # Ponowne wywołanie z tym samym `external_id` i `source` zwraca istniejące zamówienie.
  def create_from(account:, source:, items:, external_id: nil, source_channel: nil, customer: nil, price_group: nil, warehouse_id: nil,
                  shipping: {}, billing_address: {}, shipping_address: {}, notes: nil, placed_at: nil, user: nil)
    source = source.to_s
    external_id = external_id&.to_s
    if external_id && (existing = Order.find_by(account:, source:, external_id:))
      return existing
    end

    # Savepoint: przy wyścigu o ten sam external_id nie psujemy transakcji wywołującego.
    Order.transaction(requires_new: true) do
      buyer = resolve_customer(account, customer)
      price_group ||= Inventory.default_price_group_for(account, items.map { _1.to_h.symbolize_keys[:product_id] })
      order = Order.new(
        account:, source:, source_channel:, external_id:, notes:,
        price_group_id: price_group.id, currency: price_group.currency,
        stock_reserved: Inventory.reservations_enabled?(account, RESERVATION_SOURCE.fetch(source)),
        warehouse_id: warehouse_id || Inventory.warehouse_for_source(account, RESERVATION_SOURCE.fetch(source)),
        number: NumberSequence.next_number(account),
        placed_at: placed_at || Time.current,
        customer_id: buyer&.id,
        customer_name: buyer&.display_name,
        customer_email: buyer&.email,
        customer_phone: buyer&.phone,
        shipping_method: shipping[:method],
        shipping_cents: shipping[:price_cents].to_i,
        billing_address:, shipping_address: shipping_address.presence || buyer&.default_address || {}
      )
      build_items(account, order, items, price_group)
      order.recalculate_totals
      order.save!
      order.status_changes.create!(to_status: order.status, user_id: user&.id)

      if order.stock_reserved?
        order.items.select(&:product_id).each do |item|
          Inventory.reserve!(account, item.product_id, item.quantity, holder: order, warehouse_id: order.warehouse_id)
        end
      end
      order
    end
  rescue ActiveRecord::RecordNotUnique
    raise unless external_id

    Order.find_by!(account:, source:, external_id:)
  end

  # Zmienia status zamówienia i pilnuje skutków w magazynie:
  # wysłane → zdjęcie ze stanu (z rezerwacji albo bezpośrednio), anulowane → zwolnienie rezerwacji,
  # zwrócone → przyjęcie towaru z powrotem do magazynów, z których wyszedł.
  def transition!(order, to:, user: nil, note: nil)
    to = to.to_s
    order.with_lock do
      unless order.can_transition_to?(to)
        raise InvalidTransition, "Nie można zmienić statusu z „#{STATUS_LABELS[order.status]}” na „#{STATUS_LABELS.fetch(to, to)}”."
      end

      case to
      when "shipped" then ship!(order, user:)
      when "cancelled" then cancel_stock!(order, user:)
      when "returned" then Inventory.restock!(order, user:)
      end

      from = order.status
      order.status = to
      order.payment_status = :paid if to == "paid"
      order.save!
      order.status_changes.create!(from_status: from, to_status: to, user_id: user&.id, note:)
    end
    order
  end

  # Zamówienia konta od najnowszych, stronicowane kursorem (id ostatniego elementu poprzedniej strony).
  # Zwraca [zamówienia, next_cursor].
  def list(account, cursor: nil, limit: 50, status: nil, source: nil)
    limit = limit.to_i.clamp(1, 100)
    scope = Order.where(account:).includes(:items).order(id: :desc)
    scope = scope.where(id: ...cursor.to_i) if cursor.present?
    scope = scope.where(status:) if status.present?
    scope = scope.where(source:) if source.present?

    records = scope.limit(limit + 1).to_a
    next_cursor = records.size > limit ? records[limit - 1].id : nil
    [ records.first(limit), next_cursor ]
  end

  def find(account, id)
    Order.where(account:).includes(:items, :status_changes).find(id)
  end

  def format_money(cents, currency = "PLN")
    Inventory.format_price(cents, currency)
  end

  def resolve_customer(account, customer)
    return if customer.blank?

    customer = customer.to_h.symbolize_keys
    if customer[:channel].present? && customer[:external_id].present?
      Customers.find_or_create_by_identity!(account, channel: customer[:channel], external_id: customer[:external_id],
        handle: customer[:handle], attrs: customer)
    else
      Customers.find_or_create!(account, customer)
    end
  end
  private_class_method :resolve_customer

  def build_items(account, order, items, price_group)
    raise ArgumentError, "Zamówienie musi mieć co najmniej jedną pozycję" if items.blank?

    items = items.map { _1.to_h.symbolize_keys }
    products = Inventory.find_products(account, ids: items.filter_map { _1[:product_id] }, price_group:).index_by(&:id)

    items.each do |item|
      if item[:product_id]
        product = products.fetch(item[:product_id].to_i) do
          raise ActiveRecord::RecordNotFound, "Produkt #{item[:product_id]} nie istnieje albo ma warianty - wybierz wariant"
        end
        unit_price_cents = item.fetch(:unit_price_cents, product.price_cents)
        if unit_price_cents.nil?
          raise ArgumentError, "Produkt #{product.sku} nie ma ceny w grupie cenowej zamówienia - podaj unit_price_cents"
        end

        order.items.build(account:, product_id: product.id, sku: product.sku, name: product.name, tax_rate: product.tax_rate,
          quantity: item[:quantity], unit_price_cents:)
      else
        order.items.build(account:, **item.slice(:sku, :name, :quantity, :unit_price_cents, :tax_rate))
      end
    end
  end
  private_class_method :build_items

  # Wysyłka: realizuje aktywne rezerwacje, a to, czego jeszcze nie zdjęto ze stanu (brak rezerwacji, rezerwacja
  # zwolniona ręcznie na karcie produktu), zdejmuje teraz. Sztuki zrealizowane wcześniej ręcznie nie schodzą drugi raz.
  def ship!(order, user:)
    Inventory.commit!(order, user:)
    order.items.select(&:product_id).group_by(&:product_id).each do |product_id, items|
      missing = items.sum(&:quantity) - Inventory.sold_quantity(order, product_id)
      next unless missing.positive?

      Inventory.deduct!(order.account, product_id, missing, holder: order, warehouse_id: order.warehouse_id, user:)
    end
  end
  private_class_method :ship!

  # Anulowanie: zwalnia rezerwacje i przyjmuje z powrotem towar, który już wyszedł (np. rezerwacja zrealizowana ręcznie).
  def cancel_stock!(order, user:)
    Inventory.release!(order)
    Inventory.restock!(order, user:)
  end
  private_class_method :cancel_stock!
end
