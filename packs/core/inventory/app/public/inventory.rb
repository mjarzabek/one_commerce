# Publiczne API Inventory (w panelu sekcja „Produkty”): magazyny, katalogi, produkty proste i wariantowe, grupy cenowe, stany i rezerwacje.
# Jedyne miejsce, które zmienia stany - moduły nie dotykają tabel inventory_*.
#
# Ceny i stany mają produkty sprzedawalne: proste i warianty (produkt główny wariantowy ich nie ma).
# Magazyny są wspólne dla konta, a katalog wybiera, z których korzysta. Stan produktu jest osobny w każdym
# magazynie jego katalogu; stan łączny = suma tych magazynów. Zamówienie realizowane jest z jednego magazynu -
# wybranego dla źródła zamówień (Live / E-commerce / Ręczne) w ustawieniach źródeł.
#
# Cykl życia sztuki w zamówieniu:
#   z rezerwacją:   reserve!(…, holder: order) → commit!(order) przy wysyłce / release!(order) przy anulowaniu
#   bez rezerwacji: deduct!(…, holder: order) przy wysyłce
#   zwrot:          restock!(order) - odwraca sprzedaż w tych samych magazynach
#
# Posiadacz (holder) to dowolny rekord z `id`; jeśli ma metodę `inventory_label` (np. „Zamówienie 2026/000004”),
# trafia ona do rezerwacji i historii ruchów.
module Inventory
  def self.table_name_prefix = "inventory_"

  RESERVATION_SOURCES = SourceSetting::SOURCES

  class InsufficientStock < StandardError
    attr_reader :product_id, :requested, :available

    def initialize(product_id:, requested:, available:)
      @product_id, @requested, @available = product_id, requested, available
      super("Brak wystarczającego stanu produktu #{product_id}: potrzeba #{requested}, dostępne #{available}.")
    end
  end

  class NotSellable < ArgumentError; end

  # Ręczna zmiana stanu w magazynie ze ścisłą kontrolą - tam stan zmieniają tylko dokumenty magazynowe.
  class StrictControl < StandardError; end

  module_function

  PRODUCT_ID_START = 110_000_000

  # ID produktów zaczynają się od PRODUCT_ID_START (nie zdradzają liczby produktów na platformie). schema.rb nie zapisuje
  # stanu sekwencji, więc wywołują to: migracja, lib/tasks/product_ids.rake (po załadowaniu schematu) i db/seeds.rb.
  # Nigdy nie cofa sekwencji.
  def ensure_product_id_start!
    return unless Product.table_exists?

    Product.connection.execute(<<~SQL)
      SELECT setval(pg_get_serial_sequence('inventory_products', 'id'), #{PRODUCT_ID_START}, false)
      WHERE (SELECT COALESCE(MAX(id), 0) FROM inventory_products) < #{PRODUCT_ID_START}
        AND (SELECT last_value FROM inventory_products_id_seq) < #{PRODUCT_ID_START}
    SQL
  end

  # --- Konfiguracja konta -------------------------------------------------------------------------

  # Magazyn główny, domyślny katalog (korzystający z tego magazynu) i domyślna grupa cenowa. Idempotentne.
  def ensure_setup!(account)
    unless PriceGroup.exists?(account:, default: true)
      PriceGroup.where(account:).ordered.first&.make_default! ||
        PriceGroup.create!(account:, name: "Detal", currency: "PLN", default: true)
    end
    Warehouse.create!(account:, name: "Magazyn główny") unless Warehouse.exists?(account:)
    unless Catalog.exists?(account:)
      Catalog.create!(account:, name: "Domyślny",
        warehouse_ids: Warehouse.where(account:).order(:position, :id).limit(1).ids,
        price_group_ids: PriceGroup.where(account:, default: true).ids)
    end
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  def catalogs(account)
    Catalog.where(account:).order(:position, :id)
  end

  def default_catalog(account)
    ensure_setup!(account)
    catalogs(account).first
  end

  # Grupy cenowe konta albo - z `catalog:` - grupy, z których korzysta katalog.
  def price_groups(account, catalog: nil)
    scope = PriceGroup.where(account:).ordered
    catalog ? scope.where(id: CatalogPriceGroup.where(catalog:).select(:price_group_id)) : scope
  end

  # Domyślna grupa cenowa konta. Z `catalog:` - grupa domyślna konta, jeśli katalog z niej korzysta,
  # w przeciwnym razie pierwsza z grup katalogu.
  def default_price_group(account, catalog: nil)
    ensure_setup!(account)
    return PriceGroup.find_by!(account:, default: true) unless catalog

    price_groups(account, catalog:).first || PriceGroup.find_by!(account:, default: true)
  end

  # Magazyny konta albo - z `catalog:` - magazyny, z których korzysta katalog.
  # Domyślna grupa cenowa dla produktów (wg katalogu pierwszego z nich) - np. dla zamówienia z Live.
  def default_price_group_for(account, product_ids)
    catalog_id = Product.where(account:, id: Array(product_ids).compact).order(:id).pick(:catalog_id)
    default_price_group(account, catalog: catalog_id && Catalog.find(catalog_id))
  end

  def warehouses(account, catalog: nil)
    scope = Warehouse.where(account:).order(:position, :id)
    catalog ? scope.where(id: CatalogWarehouse.where(catalog:).select(:warehouse_id)) : scope
  end

  # --- Źródła zamówień (live / ecommerce / manual): magazyn i rezerwacje ------------------------

  def reservations_enabled?(account, source)
    SourceSetting.find_by(account:, source: source.to_s)&.enabled != false
  end

  # Magazyn, z którego schodzi towar zamówień ze źródła. Domyślnie pierwszy magazyn konta.
  def warehouse_for_source(account, source)
    ensure_setup!(account)
    SourceSetting.find_by(account:, source: source.to_s)&.warehouse_id || warehouses(account).first.id
  end

  # { "live" => { enabled: true, warehouse_id: 1 }, … } - z wartościami domyślnymi dla nieustawionych źródeł.
  def source_settings(account)
    stored = SourceSetting.where(account:).index_by(&:source)
    default_warehouse = warehouses(account).first&.id
    RESERVATION_SOURCES.to_h do |source|
      setting = stored[source]
      [ source, { enabled: setting ? setting.enabled : true, warehouse_id: setting&.warehouse_id || default_warehouse } ]
    end
  end

  def update_source_setting!(account, source, enabled: nil, warehouse_id: nil)
    setting = SourceSetting.find_or_initialize_by(account:, source: source.to_s)
    setting.enabled = enabled unless enabled.nil?
    setting.warehouse_id = warehouse_id if warehouse_id
    setting.save!
  end

  # --- Produkty -------------------------------------------------------------------------------

  # Tworzy produkt prosty albo wariantowy (gdy podano `variants:`).
  # Ceny: `price_cents` (grupa domyślna) albo `prices: { price_group_id => grosze }`.
  #
  #   Inventory.create_product!(account, { name: "Kubek", sku: "KUBEK", price_cents: 4_900 })
  #   Inventory.create_product!(account, { name: "Sukienka Lena", sku: "LENA" },
  #     variants: [ { name: "S", sku: "LENA-S", price_cents: 19_900 }, { name: "M", sku: "LENA-M", price_cents: 19_900 } ])
  def create_product!(account, attrs, variants: nil, catalog: nil)
    catalog ||= default_catalog(account)
    default_group_id = default_price_group(account).id

    Product.transaction do
      product = build_product(Product.new(account:, catalog:), attrs, default_group_id)
      Array(variants).each_with_index do |variant_attrs, position|
        build_product(product.variants.build(account:, catalog:, position:), variant_attrs, default_group_id)
      end
      product.save!
      product
    end
  end

  # Produkty główne (proste i wariantowe) z wariantami i cenami.
  def products(account, catalog: nil)
    scope = Product.main.where(account:).includes(:prices, variants: :prices).order(:name, :id)
    catalog ? scope.where(catalog:) : scope
  end

  def find_product(account, id)
    Product.where(account:).includes(:prices, :parent, variants: :prices).find(id)
  end

  # Migawki produktów sprzedawalnych konta po id lub SKU (opcjonalnie w katalogu),
  # z ceną z grupy (domyślnie - domyślnej). Produkty główne wariantowe są pomijane.
  def find_products(account, ids: nil, skus: nil, catalog: nil, price_group: nil)
    price_group ||= default_price_group(account)
    scope = Product.where(account:).includes(:prices, :parent, :variants)
    scope = scope.where(id: ids) if ids
    scope = scope.where(sku: skus) if skus
    scope = scope.where(catalog:) if catalog
    scope.select(&:sellable?).map { product_info(_1, price_group) }
  end

  DeleteResult = Data.define(:deleted, :skipped)

  # Usuwa produkty główne razem z wariantami. Pomija (i zwraca w `skipped`) produkty, które mają towar
  # lub rezerwacje, historię ruchów albo są w zamówieniach - takie należy zarchiwizować.
  def delete_products!(account, ids)
    deleted = 0
    skipped = []
    Product.main.where(account:, id: ids).includes(:variants).find_each do |product|
      family = [ product.id, *product.variants.map(&:id) ]
      if StockItem.where(product_id: family).where("on_hand > 0 OR reserved > 0").exists?
        skipped << product.name
        next
      end

      Product.transaction(requires_new: true) do
        StockItem.where(product_id: family).delete_all
        Product.where(id: product.variants.map(&:id)).delete_all
        Product.where(id: product.id).delete_all
      end
      deleted += 1
    rescue ActiveRecord::InvalidForeignKey
      skipped << product.name
    end
    DeleteResult.new(deleted:, skipped:)
  end

  def update_status!(account, ids, status)
    raise ArgumentError, "Nieznany status: #{status}" unless Product.statuses.key?(status.to_s)

    Product.main.where(account:, id: ids).update_all(status: status.to_s, updated_at: Time.current)
  end

  # Ustawia cenę produktu w grupie cenowej (nil usuwa cenę z grupy).
  def set_price!(account, product_id, price_group, amount_cents)
    product = Product.find_by!(account:, id: product_id)
    raise ActiveRecord::RecordNotFound, "Grupa cenowa nie należy do konta" unless price_group.account_id == account.id

    price = Price.find_or_initialize_by(product:, price_group:)
    amount_cents.nil? ? (price.destroy! if price.persisted?) : price.update!(account:, amount_cents:)
  end

  # --- Stany ---------------------------------------------------------------------------------

  # Dostępne sztuki (on_hand - reserved): { product_id => liczba } - stan łączny (suma magazynów katalogu)
  # albo stan jednego magazynu (`warehouse_id`). Dla produktu głównego wariantowego - suma wariantów.
  def available(account, product_ids, warehouse_id: nil)
    ids = Array(product_ids).map(&:to_i)
    children = Product.where(account:, parent_id: ids).pluck(:parent_id, :id).group_by(&:first).transform_values { _1.map(&:last) }
    items = StockItem.where(account:, product_id: ids + children.values.flatten)
    items = warehouse_id ? items.where(warehouse_id:) : items.joins(:product).where(
      "EXISTS (SELECT 1 FROM inventory_catalog_warehouses cw WHERE cw.catalog_id = inventory_products.catalog_id " \
      "AND cw.warehouse_id = inventory_stock_items.warehouse_id)"
    )
    totals = items.group(:product_id).sum("inventory_stock_items.on_hand - inventory_stock_items.reserved")

    ids.to_h { |id| [ id, children.key?(id) ? children[id].sum { totals.fetch(_1, 0) } : totals.fetch(id, 0) ] }
  end

  # Stany w poszczególnych magazynach: { product_id => { warehouse_id => StockItem } }.
  def stock_levels(account, product_ids)
    StockItem.where(account:, product_id: product_ids).group_by(&:product_id)
      .transform_values { |items| items.index_by(&:warehouse_id) }
  end

  def stock_items(account)
    StockItem.where(account:).order(:warehouse_id, :product_id)
  end

  # Przyjęcie towaru do magazynu bez dokumentu (domyślnie: pierwszy magazyn katalogu produktu).
  # Rzuca StrictControl w magazynie ze ścisłą kontrolą.
  def receive!(account, product_id, quantity, warehouse_id: nil, reason: :receipt, reference: nil, user: nil)
    raise ArgumentError, "Ilość musi być dodatnia" unless quantity.positive?

    StockItem.transaction do
      product = sellable_product(account, product_id)
      item = locked_items(product, [ warehouse_id || warehouse_ids_for(product).first ]).first
      ensure_manual_changes!(item)
      change_on_hand!(item, quantity, reason:, reference:, user:)
    end
  end

  # Ręczna zmiana stanu (edycja pola „Na stanie”): ustawia stan fizyczny produktu w magazynie,
  # a historia zapisuje, z ilu na ile. Rzuca StrictControl w magazynie ze ścisłą kontrolą.
  def set_on_hand!(account, product_id, on_hand, warehouse_id: nil, reference: nil, user: nil)
    StockItem.transaction do
      product = sellable_product(account, product_id)
      item = locked_items(product, [ warehouse_id || warehouse_ids_for(product).first ]).first
      delta = on_hand - item.on_hand
      ensure_manual_changes!(item) unless delta.zero?
      change_on_hand!(item, delta, reason: :adjustment, reference:, user:) unless delta.zero?
      item
    end
  end

  # Ustawia dostępne sztuki (edycja z listy): stan fizyczny = dostępne + zarezerwowane w chwili zapisu.
  def set_available!(account, product_id, available, warehouse_id:, user: nil)
    StockItem.transaction do
      item = locked_items(sellable_product(account, product_id), [ warehouse_id ]).first
      set_on_hand!(account, product_id, available + item.reserved, warehouse_id:, user:)
    end
  end

  # Rezerwuje sztuki w magazynie (magazyn zamówienia). Rzuca InsufficientStock, gdy w tym magazynie brakuje towaru.
  def reserve!(account, product_id, quantity, holder:, warehouse_id:, expires_at: nil)
    raise ArgumentError, "Ilość musi być dodatnia" unless quantity.positive?

    StockItem.transaction do
      item = available_item(sellable_product(account, product_id), warehouse_id, quantity)
      item.update!(reserved: item.reserved + quantity)
      Reservation.create!(account:, warehouse_id:, product_id: item.product_id, quantity:, expires_at:,
        holder_type: holder.class.name, holder_id: holder.id, holder_label: holder_label(holder))
    end
  end

  # Wydanie z magazynu bez wcześniejszej rezerwacji (źródło z wyłączonymi rezerwacjami, przy wysyłce).
  def deduct!(account, product_id, quantity, holder:, warehouse_id:, user: nil)
    raise ArgumentError, "Ilość musi być dodatnia" unless quantity.positive?

    StockItem.transaction do
      item = available_item(sellable_product(account, product_id), warehouse_id, quantity)
      change_on_hand!(item, -quantity, reason: :sale, reference: nil, holder:, user:)
    end
  end

  # Zwalnia aktywne rezerwacje posiadacza (anulowanie, porzucony koszyk).
  def release!(holder)
    settle!(holder, :released)
  end

  # Zamienia aktywne rezerwacje posiadacza na wydanie z magazynu (wysyłka).
  def commit!(holder, user: nil)
    settle!(holder, :fulfilled, user:)
  end

  # Przyjmuje z powrotem towar sprzedany posiadaczowi, do tych samych magazynów (zwrot, anulowanie po wydaniu).
  def restock!(holder, user: nil)
    StockItem.transaction do
      net = Movement.held_by(holder).where(reason: %w[sale return]).group(:warehouse_id, :product_id).sum(:quantity)
      net.each do |(warehouse_id, product_id), quantity|
        next unless quantity.negative?

        item = StockItem.lock.find_by!(warehouse_id:, product_id:)
        change_on_hand!(item, -quantity, reason: :return, reference: nil, holder:, user:)
      end
    end
  end

  # Ile sztuk produktu wyszło już z magazynu dla posiadacza (sprzedaż minus zwroty).
  def sold_quantity(holder, product_id)
    -Movement.held_by(holder).where(product_id:, reason: %w[sale return]).sum(:quantity)
  end

  # Ręczne zwolnienie jednej aktywnej rezerwacji (np. z karty produktu).
  def release_reservation!(account, reservation_id)
    StockItem.transaction { settle_reservation!(Reservation.where(account:).active.lock.find(reservation_id), :released) }
  end

  # Ręczna realizacja jednej aktywnej rezerwacji - towar schodzi ze stanu teraz.
  def fulfill_reservation!(account, reservation_id, user: nil)
    StockItem.transaction { settle_reservation!(Reservation.where(account:).active.lock.find(reservation_id), :fulfilled, user:) }
  end

  def reservations_for(holder)
    Reservation.held_by(holder).order(:id)
  end

  # --- Kwoty ---------------------------------------------------------------------------------

  def format_price(cents, currency = "PLN")
    return if cents.nil?

    unit = currency == "PLN" ? "zł" : currency
    ActiveSupport::NumberHelper.number_to_currency(cents.to_d / 100, unit:, format: "%n %u", separator: ",", delimiter: " ",
      precision: 2, strip_insignificant_zeros: false)
  end

  # Grosze → wartość pola formularza („199,90”); nil bez kwoty.
  def format_money_input(cents)
    cents && format("%.2f", cents / 100.0).tr(".", ",")
  end

  # „199,99”, „199.99”, „1 299” → grosze; nil dla nieprawidłowej kwoty.
  def parse_money(value)
    normalized = value.to_s.gsub(/[[:space:]]/, "").tr(",", ".")
    return unless normalized.match?(/\A\d+(\.\d{1,2})?\z/)

    (BigDecimal(normalized) * 100).to_i
  end

  # --- Wewnętrzne -----------------------------------------------------------------------------

  def build_product(product, attrs, default_group_id)
    attrs = attrs.to_h.symbolize_keys
    prices = attrs.delete(:prices).to_h
    prices[default_group_id] ||= attrs.delete(:price_cents) if attrs.key?(:price_cents)
    product.assign_attributes(attrs.slice(:name, :sku, :ean, :description, :status, :tax_rate, :weight_grams))
    prices.compact.each { |group_id, cents| product.prices.build(account: product.account, price_group_id: group_id.to_i, amount_cents: cents) }
    product
  end
  private_class_method :build_product

  def product_info(product, price_group)
    ProductInfo.new(
      id: product.id, parent_id: product.parent_id, catalog_id: product.catalog_id, sku: product.sku, ean: product.ean,
      name: product.display_name, tax_rate: product.effective_tax_rate,
      price_group_id: price_group.id, price_cents: product.price_cents_in(price_group.id), currency: price_group.currency
    )
  end
  private_class_method :product_info

  def sellable_product(account, product_id)
    product = Product.find_by!(account:, id: product_id)
    raise NotSellable, "Produkt „#{product.name}” ma warianty - wybierz wariant" unless product.sellable?

    product
  end
  private_class_method :sellable_product

  def warehouse_ids_for(product)
    Warehouse.where(id: CatalogWarehouse.where(catalog_id: product.catalog_id).select(:warehouse_id)).order(:position, :id).pluck(:id)
  end
  private_class_method :warehouse_ids_for

  def settle!(holder, status, user: nil)
    StockItem.transaction do
      Reservation.held_by(holder).active.lock.order(:warehouse_id, :id).each { settle_reservation!(_1, status, user:) }
    end
  end
  private_class_method :settle!

  # Zamyka rezerwację: zwolnienie (reserved maleje) albo realizacja (reserved i on_hand maleją, ruch „sprzedaż”).
  def settle_reservation!(reservation, status, user: nil)
    item = StockItem.lock.find_by!(warehouse_id: reservation.warehouse_id, product_id: reservation.product_id)
    item.reserved -= reservation.quantity
    if status == :fulfilled
      before = item.on_hand
      item.on_hand -= reservation.quantity
      Movement.create!(account_id: item.account_id, warehouse_id: item.warehouse_id, product_id: item.product_id,
        quantity: -reservation.quantity, on_hand_before: before, on_hand_after: item.on_hand, reason: :sale,
        holder_type: reservation.holder_type, holder_id: reservation.holder_id, holder_label: reservation.holder_label,
        user_id: user&.id)
    end
    item.save!
    reservation.update!(status:)
  end
  private_class_method :settle_reservation!

  # Zablokowany wiersz stanu z wystarczającą liczbą dostępnych sztuk - albo InsufficientStock.
  def available_item(product, warehouse_id, quantity)
    item = locked_items(product, [ warehouse_id ]).first
    raise InsufficientStock.new(product_id: product.id, requested: quantity, available: item.available) if item.available < quantity

    item
  end
  private_class_method :available_item

  def ensure_manual_changes!(item)
    return unless item.warehouse.strict_control?

    raise StrictControl, "Magazyn „#{item.warehouse.name}” ma ścisłą kontrolę - stan zmienisz tylko dokumentem magazynowym"
  end
  private_class_method :ensure_manual_changes!

  def change_on_hand!(item, delta, reason:, reference:, user:, holder: nil)
    before = item.on_hand
    item.update!(on_hand: before + delta)
    Movement.create!(account_id: item.account_id, warehouse_id: item.warehouse_id, product_id: item.product_id,
      quantity: delta, on_hand_before: before, on_hand_after: item.on_hand, reason:, reference:,
      holder_type: holder&.class&.name, holder_id: holder&.id, holder_label: holder && holder_label(holder), user_id: user&.id)
    item
  end
  private_class_method :change_on_hand!

  # Wiersze stanu zablokowane do końca transakcji (SELECT … FOR UPDATE), tworzone przy pierwszym użyciu.
  def locked_items(product, warehouse_ids)
    valid_ids = warehouse_ids_for(product) & warehouse_ids
    if valid_ids.size != warehouse_ids.uniq.size
      raise ActiveRecord::RecordNotFound, "Katalog „#{product.catalog.name}” nie korzysta z magazynu wybranego dla zamówienia"
    end

    rows = warehouse_ids.map { { account_id: product.account_id, warehouse_id: _1, product_id: product.id } }
    StockItem.insert_all(rows, unique_by: %i[warehouse_id product_id]) if rows.any?
    StockItem.lock.where(product_id: product.id, warehouse_id: warehouse_ids).order(:warehouse_id).to_a
  end
  private_class_method :locked_items

  def holder_label(holder)
    holder.respond_to?(:inventory_label) ? holder.inventory_label : "#{holder.class.name.demodulize} #{holder.id}"
  end
  private_class_method :holder_label
end
