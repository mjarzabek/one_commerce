# Publiczne API panelu zamówień. Moduły tworzą i zmieniają zamówienia wyłącznie przez te metody.
#
#   Orders.create_from(account:, source: :live, external_id: "cart-42",
#     customer: { channel: "facebook", external_id: "1234", name: "Anna Kowalska" },
#     items: [ { product_id: 7, quantity: 2 } ],
#     shipping: { method: "InPost Paczkomat", price_cents: 1_499 })
module Orders
  def self.table_name_prefix = "orders_"

  SOURCES = Order.sources.keys.freeze

  SOURCE_LABELS = { "live" => "Live", "multichannel" => "E-commerce", "manual" => "Ręczne", "api" => "API" }.freeze
  PAYMENT_STATUS_LABELS = { "unpaid" => "Nieopłacone", "partial" => "Częściowo", "paid" => "Opłacone", "overpaid" => "Nadpłata" }.freeze
  STOCK_STATE_LABELS = {
    deducted: "Ściągnięty", returned: "Zwrócony", reserved: "Rezerwacja", cancelled: "Anulowany", none: "Bez rezerwacji"
  }.freeze
  PAYMENT_METHOD_LABELS = { "transfer" => "Przelew", "online" => "Płatność online", "cod" => "Za pobraniem", "cash" => "Gotówka" }.freeze
  STATUS_COLORS = Status::COLORS
  CUSTOM_FIELD_KINDS = CustomField::KINDS

  # Pola adresów zamówienia (jsonb): dostawa, dane do faktury i punkt odbioru (paczkomat, punkt kurierski).
  ADDRESS_FIELDS = {
    "shipping" => %w[name company street postal_code city country phone],
    "billing" => %w[name company nip street postal_code city country],
    "pickup" => %w[name code street postal_code city]
  }.freeze
  ADDRESS_COLUMNS = { "shipping" => :shipping_address, "billing" => :billing_address, "pickup" => :pickup_point }.freeze

  class InvalidData < StandardError
    attr_reader :errors

    def initialize(errors)
      @errors = errors
      super(errors.values.flatten.to_sentence)
    end
  end

  # Statusy i grupy, które dostaje każde konto na start (potem edytowalne w ustawieniach). Pierwszy jest domyślny.
  DEFAULT_STATUS_GROUPS = [ "Do realizacji", "Zakończone" ].freeze
  DEFAULT_STATUSES = [
    { name: "Nowe", color: "blue", group: "Do realizacji" },
    { name: "Potwierdzone", color: "violet", group: "Do realizacji" },
    { name: "W realizacji", color: "amber", group: "Do realizacji" },
    { name: "Wysłane", color: "sky", group: "Zakończone" },
    { name: "Dostarczone", color: "green", group: "Zakończone" },
    { name: "Anulowane", color: "red", group: nil },
    { name: "Zwrócone", color: "gray", group: nil }
  ].freeze

  # Które ustawienie rezerwacji z Inventory (live / ecommerce / manual) obowiązuje dane źródło zamówienia.
  RESERVATION_SOURCE = { "live" => "live", "multichannel" => "ecommerce", "manual" => "manual", "api" => "manual" }.freeze

  module_function

  # Domyślne grupy i statusy dla konta bez statusów; konto ze statusami, ale bez domyślnego - pierwszy staje się domyślnym.
  def ensure_setup!(account)
    return if Status.exists?(account:, default: true)

    if (first = Status.where(account:).ordered.first)
      first.make_default!
      return
    end

    Status.transaction(requires_new: true) do
      groups = DEFAULT_STATUS_GROUPS.to_h { [ _1, StatusGroup.create!(account:, name: _1) ] }
      DEFAULT_STATUSES.each_with_index do |status, index|
        Status.create!(account:, name: status[:name], color: status[:color], status_group: groups[status[:group]], default: index.zero?)
      end
    end
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def statuses(account)
    ensure_setup!(account)
    Status.where(account:).ordered
  end

  def status_groups(account)
    ensure_setup!(account)
    StatusGroup.where(account:).ordered
  end

  def custom_fields(account)
    CustomField.where(account:).ordered
  end

  # Sposoby dostawy użyte w zamówieniach konta (alfabetycznie) - podpowiedzi w formularzach i filtrze listy.
  def shipping_methods(account)
    Order.where(account:).where.not(shipping_method: [ nil, "" ]).distinct.order(:shipping_method).pluck(:shipping_method)
  end

  def default_status(account)
    ensure_setup!(account)
    Status.find_by!(account:, default: true)
  end

  # Tworzy zamówienie z pozycjami i rezerwuje towar - wszystko albo nic.
  #
  # items:    [{ product_id:, quantity:, unit_price_cents: (opcjonalnie, domyślnie cena z grupy cenowej) }]
  #           - produkt prosty albo wariant (nie produkt główny wariantowy)
  #           albo pozycja spoza katalogu: [{ sku:, name:, quantity:, unit_price_cents:, tax_rate: }]
  # customer: { channel:, external_id:, handle:, name:, email:, phone: } - z tożsamością w kanale
  #           albo { name:, email:, phone: } - zamówienie ręczne; nil - bez klienta.
  # Adresy - klucze z ADDRESS_FIELDS: shipping_address (dostawa), billing_address (faktura, z `nip`),
  # pickup_point (punkt odbioru: { name:, code:, street:, postal_code:, city: }); wants_invoice - klient chce fakturę.
  # customer_message - wiadomość klienta do zamówienia (z formularza sklepu / marketplace'u).
  # payment_method: transfer | online | cod (za pobraniem) | cash. Wpłata: paid_cents (kwota wpłacona, domyślnie 0)
  # albo payment_status: :paid - skrót „wpłacono całość”. Status płatności wynika z kwoty (Order#payment_status).
  # Zamówienie dostaje domyślny status konta.
  #
  # Ceny i waluta pochodzą z `price_group` (domyślnie: domyślna grupa katalogu zamawianych produktów).
  # Zamówienie realizowane jest z jednego magazynu: `warehouse_id` albo magazynu ustawionego dla źródła
  # (Produkty › Ustawienia › Ogólne › Źródła zamówień). Towar jest rezerwowany od razu, jeśli źródło ma włączone rezerwacje -
  # wtedy przy braku towaru w tym magazynie rzuca Inventory::InsufficientStock. Bez rezerwacji towar schodzi
  # ze stanu dopiero przy wysyłce.
  #
  # Ponowne wywołanie z tym samym `external_id` i `source` zwraca istniejące zamówienie.
  def create_from(account:, source:, items:, external_id: nil, source_channel: nil, customer: nil, price_group: nil, warehouse_id: nil,
                  shipping: {}, billing_address: {}, shipping_address: {}, notes: nil, placed_at: nil, user: nil,
                  payment_method: nil, payment_status: nil, paid_cents: nil, pickup_point: {}, wants_invoice: false,
                  customer_message: nil)
    source = source.to_s
    external_id = external_id&.to_s
    if external_id && (existing = Order.find_by(account:, source:, external_id:))
      return existing
    end

    status = default_status(account)
    # Savepoint: przy wyścigu o ten sam external_id nie psujemy transakcji wywołującego.
    Order.transaction(requires_new: true) do
      buyer = resolve_customer(account, customer)
      price_group ||= Inventory.default_price_group_for(account, items.map { _1.to_h.symbolize_keys[:product_id] })
      order = Order.new(
        account:, source:, source_channel:, external_id:, notes:, status:, customer_message: customer_message.to_s.strip.presence,
        payment_method:,
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
        wants_invoice:, pickup_point: clean_address("pickup", pickup_point),
        billing_address: clean_address("billing", billing_address),
        shipping_address: clean_address("shipping", shipping_address.presence || buyer&.default_address || {})
      )
      build_items(account, order, items, price_group)
      order.recalculate_totals
      order.paid_cents = paid_cents || (payment_status.to_s == "paid" ? order.total_cents : 0)
      order.save!
      order.status_changes.create!(to_status: status.name, to_status_id: status.id, user_id: user&.id)

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

  # Zmienia status zamówienia (z wpisem w historii). Dowolny status na dowolny; ten sam status - bez zmian.
  # Status nie rusza magazynu - do tego służą fulfill_stock!, release_stock! i restock! (wołane przez automatyzacje).
  # `status` - Orders::Status albo jego id (status innego konta → RecordNotFound).
  def change_status!(order, status, user: nil, note: nil)
    status = Status.where(account_id: order.account_id).find(status.is_a?(Status) ? status.id : status)
    order.with_lock do
      next if order.status_id == status.id

      from = order.status
      order.update!(status:)
      order.status_changes.create!(from_status: from.name, from_status_id: from.id, to_status: status.name, to_status_id: status.id,
        user_id: user&.id, note: note.presence)
    end
    order
  end

  # Zmiana statusów wielu zamówień konta. Zwraca liczbę zamówień, którym status faktycznie się zmienił.
  def change_statuses!(account, ids, status, user: nil)
    status = Status.where(account:).find(status.is_a?(Status) ? status.id : status)
    Order.where(account:, id: ids).where.not(status_id: status.id).includes(:status).find_each.count do |order|
      change_status!(order, status, user:)
    end
  end

  # Kwota wpłacona przez klienta (w groszach, >= 0) i opcjonalnie metoda płatności. Status płatności przelicza się sam.
  # Przy błędach rzuca InvalidData ({ "paid" => ["…"] }).
  def update_payment!(order, paid_cents:, payment_method: order.payment_method)
    raise InvalidData, { "paid" => [ "Podaj kwotę, np. 99,90" ] } unless paid_cents.is_a?(Integer) && paid_cents >= 0
    raise InvalidData, { "payment_method" => [ "Nieznana metoda płatności" ] } if payment_method.present? && !PAYMENT_METHOD_LABELS.key?(payment_method.to_s)

    order.update!(paid_cents:, payment_method: payment_method.presence)
    order
  end

  # Adres zamówienia: kind = shipping | billing | pickup. Puste pola są pomijane; NIP - same cyfry (10 dla Polski).
  # Przy błędach rzuca InvalidData ({ "nip" => ["…"] }).
  def update_address!(order, kind, attrs, wants_invoice: nil)
    kind = kind.to_s
    raise ArgumentError, "Nieznany rodzaj adresu: #{kind}" unless ADDRESS_FIELDS.key?(kind)

    address = clean_address(kind, attrs)
    if address["nip"]
      address["nip"] = address["nip"].gsub(/[^0-9A-Za-z]/, "").upcase
      polish = address["country"].blank? || address["country"].casecmp?("PL") || address["country"].casecmp?("Polska")
      raise InvalidData, { "nip" => [ "NIP musi mieć 10 cyfr" ] } if polish && !address["nip"].match?(/\A\d{10}\z/)
    end
    order.public_send(:"#{ADDRESS_COLUMNS.fetch(kind)}=", address)
    order.wants_invoice = wants_invoice unless wants_invoice.nil?
    order.save!
    order
  end

  # Dane kontaktowe klienta w zamówieniu (migawka - karta klienta w Customers się nie zmienia).
  def update_customer!(order, name:, email:, phone:)
    email = email.to_s.strip.presence
    raise InvalidData, { "email" => [ "Nieprawidłowy adres e-mail" ] } if email && !email.match?(URI::MailTo::EMAIL_REGEXP)

    order.update!(customer_name: name.to_s.strip.presence, customer_email: email, customer_phone: phone.to_s.strip.presence)
    order
  end

  # Wartości pól dodatkowych: { "<id pola>" => wartość } - tylko pola konta, puste usuwają wartość.
  # Przy błędach rzuca InvalidData ({ "<id pola>" => ["Podaj liczbę"] }) i niczego nie zapisuje.
  def update_custom_fields!(order, values)
    values = values.to_h.transform_keys(&:to_s)
    result = order.custom_fields.dup
    errors = {}
    CustomField.where(account_id: order.account_id).where(id: values.keys).find_each do |field|
      value, error = field.cast(values[field.id.to_s])
      next errors[field.id.to_s] = [ error ] if error

      value.nil? ? result.delete(field.id.to_s) : result[field.id.to_s] = value
    end
    raise InvalidData, errors if errors.any?

    order.update!(custom_fields: result)
    order
  end

  # Sposób i koszt dostawy (w groszach, >= 0). Wartość zamówienia i status płatności przeliczają się.
  # Przy błędach rzuca InvalidData ({ "price" => ["…"] }).
  def update_shipping!(order, method:, price_cents:)
    raise InvalidData, { "price" => [ "Podaj kwotę, np. 14,99" ] } unless price_cents.is_a?(Integer) && price_cents >= 0

    order.shipping_method = method.to_s.strip.presence
    order.shipping_cents = price_cents
    order.recalculate_totals
    order.save!
    order
  end

  # --- Pozycje zamówienia ------------------------------------------------------------------
  # Dodanie, zmiana i usunięcie pozycji przeliczają wartość zamówienia (i status płatności). Rezerwacje towaru
  # idą za pozycjami, dopóki zamówienie ma aktywną rezerwację. Gdy towar już zszedł ze stanu, nie można zmieniać
  # ilości ani składu pozycji z katalogu (cenę i nazwę - tak). Błędy: InvalidData ({ "quantity" => ["…"] }).

  # attrs: { product_id:, quantity:, unit_price_cents: (opcjonalnie - cena z grupy cenowej zamówienia) }
  #     albo { name:, sku:, quantity:, unit_price_cents:, tax_rate: } - pozycja spoza katalogu.
  def add_item!(order, attrs)
    attrs = attrs.to_h.symbolize_keys
    change_items!(order, stock: attrs[:product_id].present?) do
      if attrs[:product_id].present?
        price_group = Inventory.price_groups(order.account).find_by(id: order.price_group_id) || Inventory.default_price_group(order.account)
        product = Inventory.find_products(order.account, ids: [ attrs[:product_id].to_i ], price_group:).first
        raise InvalidData, { "product_id" => [ "Wybierz produkt albo wariant z katalogu" ] } unless product

        price = attrs.key?(:unit_price_cents) ? attrs[:unit_price_cents] : product.price_cents
        raise InvalidData, { "unit_price" => [ "Podaj cenę, np. 99,90" ] } if price.nil?

        order.items.create!(product_id: product.id, sku: product.sku, name: product.name, tax_rate: product.tax_rate,
          quantity: attrs[:quantity], unit_price_cents: price)
      else
        order.items.create!(attrs.slice(:name, :sku, :quantity, :unit_price_cents, :tax_rate).compact.merge(sku: attrs[:sku].presence))
      end
    end
  end

  # attrs: quantity, unit_price_cents; dla pozycji spoza katalogu także name, sku, tax_rate.
  def update_item!(order, item_id, attrs)
    attrs = attrs.to_h.symbolize_keys
    item = order.items.find(item_id)
    allowed = item.product_id ? %i[quantity unit_price_cents] : %i[quantity unit_price_cents name sku tax_rate]
    changes = attrs.slice(*allowed)
    changes[:sku] = changes[:sku].presence if changes.key?(:sku)
    changes.delete(:tax_rate) if changes[:tax_rate].nil?
    stock = item.product_id.present? && changes.key?(:quantity) && changes[:quantity].to_i != item.quantity
    change_items!(order, stock:) { item.update!(changes) }
  end

  def remove_item!(order, item_id)
    item = order.items.find(item_id)
    raise InvalidData, { "base" => [ "Zamówienie musi mieć co najmniej jedną pozycję" ] } if order.items.size <= 1

    change_items!(order, stock: item.product_id.present?) { item.destroy! }
  end

  def update_notes!(order, notes)
    order.update!(notes: notes.to_s.strip.presence)
    order
  end

  # Wysyłka: realizuje aktywne rezerwacje, a to, czego jeszcze nie zdjęto ze stanu (brak rezerwacji, rezerwacja
  # zwolniona ręcznie na karcie produktu), zdejmuje teraz. Sztuki zrealizowane wcześniej ręcznie nie schodzą drugi raz.
  def fulfill_stock!(order, user: nil)
    order.with_lock do
      Inventory.commit!(order, user:)
      order.items.select(&:product_id).group_by(&:product_id).each do |product_id, items|
        missing = items.sum(&:quantity) - Inventory.sold_quantity(order, product_id)
        next unless missing.positive?

        Inventory.deduct!(order.account, product_id, missing, holder: order, warehouse_id: order.warehouse_id, user:)
      end
    end
    order
  end

  # Anulowanie: zwalnia rezerwacje i przyjmuje z powrotem towar, który już wyszedł (np. rezerwacja zrealizowana ręcznie).
  def release_stock!(order, user: nil)
    order.with_lock do
      Inventory.release!(order)
      Inventory.restock!(order, user:)
    end
    order
  end

  # Zwrot: przyjęcie towaru z powrotem do magazynów, z których wyszedł.
  def restock!(order, user: nil)
    order.with_lock { Inventory.restock!(order, user:) }
    order
  end

  # Zamówienia konta od najnowszych, stronicowane kursorem (id ostatniego elementu poprzedniej strony).
  # Zwraca [zamówienia, next_cursor].
  def list(account, cursor: nil, limit: 50, status_id: nil, source: nil)
    limit = limit.to_i.clamp(1, 100)
    scope = Order.where(account:).includes(:items, :status).order(id: :desc)
    scope = scope.where(id: ...cursor.to_i) if cursor.present?
    scope = scope.where(status_id:) if status_id.present?
    scope = scope.where(source:) if source.present?

    records = scope.limit(limit + 1).to_a
    next_cursor = records.size > limit ? records[limit - 1].id : nil
    [ records.first(limit), next_cursor ]
  end

  def find(account, id)
    Order.where(account:).includes(:items, :status, :status_changes).find(id)
  end

  def format_money(cents, currency = "PLN")
    Inventory.format_price(cents, currency)
  end

  # Tylko znane klucze adresu danego rodzaju, bez pustych, wartości jako tekst bez spacji na brzegach.
  def clean_address(kind, attrs)
    attrs.to_h.stringify_keys.slice(*ADDRESS_FIELDS.fetch(kind)).transform_values { _1.to_s.strip }.compact_blank
  end
  private_class_method :clean_address

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

  ITEM_ERRORS = {
    quantity: [ "quantity", "Podaj liczbę sztuk (co najmniej 1)" ],
    unit_price_cents: [ "unit_price", "Podaj cenę, np. 99,90" ],
    name: [ "name", "Podaj nazwę" ]
  }.freeze
  private_constant :ITEM_ERRORS

  # Wspólna obsługa zmian pozycji: blokada, walidacja, przeliczenie sum i rezerwacji. `stock` - zmiana dotyka
  # towaru z katalogu (ilość, dodanie, usunięcie).
  def change_items!(order, stock:)
    order.with_lock do
      state = Inventory.stock_state(order)
      if stock && %i[deducted returned].include?(state)
        raise InvalidData, { "base" => [ "Towar zszedł już ze stanu - nie można zmienić ilości ani produktów" ] }
      end

      yield
      order.items.reload
      order.recalculate_totals
      order.save!
      sync_reservations!(order) if stock && state == :reserved
    end
    order
  rescue ActiveRecord::RecordInvalid => e
    raise InvalidData, e.record.errors.attribute_names.uniq.to_h { |attribute|
      ITEM_ERRORS.fetch(attribute) { [ attribute.to_s, "Nieprawidłowa wartość" ] }.then { |key, message| [ key, [ message ] ] }
    }
  rescue Inventory::InsufficientStock => e
    raise InvalidData, { "quantity" => [ "Za mało towaru w magazynie zamówienia (dostępne: #{e.available})" ] }
  end
  private_class_method :change_items!

  # Rezerwacje od nowa według bieżących pozycji (w magazynie zamówienia).
  def sync_reservations!(order)
    Inventory.release!(order)
    order.items.select(&:product_id).group_by(&:product_id).each do |product_id, items|
      Inventory.reserve!(order.account, product_id, items.sum(&:quantity), holder: order, warehouse_id: order.warehouse_id)
    end
  end
  private_class_method :sync_reservations!

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
end
