module Inventory
  # Wspólna baza ekranów sekcji „Produkty”: dostęp z panelem zamówień, domyślna konfiguracja konta, wybór katalogu
  # i bloki karty produktu (ceny, stany w magazynach, historia, rezerwacje).
  class BaseController < InertiaController
    REASON_LABELS = { "receipt" => "Przyjęcie", "adjustment" => "Zmiana ręczna", "sale" => "Sprzedaż", "return" => "Zwrot" }.freeze
    HISTORY_LIMIT = 50
    DESCRIPTIONS = %i[description description_extra_1 description_extra_2 description_extra_3].freeze
    # Pola karty wspólne dla produktu i wariantu (dane, producent, kategoria, treść, VAT, wymiary, parametry, ceny).
    CARD_PARAMS = [ :name, :sku, :ean, :manufacturer, :category_id, *DESCRIPTIONS, :status, :tax_rate, *Product::DIMENSIONS.keys,
                    price_inputs: {}, parameters: [ [ :name, :value ] ] ].freeze

    requires_orders_panel
    before_action { Inventory.ensure_setup!(Current.account) }

    private
      def catalogs
        Catalog.where(account: Current.account).order(:position, :id)
      end

      def current_catalog
        @current_catalog ||= params[:catalog_id].present? ? catalogs.find(params[:catalog_id]) : catalogs.first
      end

      def catalogs_json
        catalogs.map { { id: _1.id, name: _1.name } }
      end

      # Grupy cenowe konta albo - z `catalog` - grupy, z których korzysta katalog.
      def price_groups(catalog = nil)
        Inventory.price_groups(Current.account, catalog:)
      end

      def price_groups_json(catalog = nil)
        price_groups(catalog).map { { id: _1.id, name: _1.name, currency: _1.currency, default: _1.default } }
      end

      def redirect_with_errors(record, to: request.referer || inventory_root_path)
        redirect_to to, inertia: { errors: inertia_errors(record) }
      end

      # Ceny produktu do pól formularza: { "price_group_id" => "199,90" } - wszystkie grupy konta
      # (formularz pokazuje tylko grupy katalogu produktu).
      def price_inputs_json(product)
        price_groups.to_h { |group| [ group.id.to_s, Inventory.format_money_input(product.price_cents_in(group.id)) ] }
      end

      # Ceny z formularza tylko dla grup, z których korzysta katalog produktu.
      def catalog_price_inputs(inputs, catalog)
        inputs.to_h.slice(*price_groups(catalog).map { _1.id.to_s })
      end

      # Pola karty produktu albo wariantu. U wariantu puste pole (null) = wartość z produktu głównego - pola z
      # dziedziczeniem przychodzą jako null, a wartości produktu głównego są w `inherited_json`.
      def card_json(product)
        own = ->(value) { product.variant? ? value&.to_s : value.to_s }
        {
          id: product.id, catalog_id: product.catalog_id, name: product.name.to_s, sku: product.sku.to_s, ean: product.ean.to_s,
          status: product.status, parameters: product.parameters,
          manufacturer: product.manufacturer.to_s, category_id: product.category_id.to_s,
          **DESCRIPTIONS.to_h { [ _1, own.(product[_1]) ] },
          tax_rate: product.tax_rate&.to_i.to_s,
          **Product::DIMENSIONS.keys.to_h { [ _1, product.public_send(_1).to_s ] },
          prices: price_inputs_json(product), hasVariants: product.persisted? && product.with_variants?
        }
      end

      # Wartości produktu głównego, które wariant dziedziczy (pokazywane jako podpowiedzi i podglądy na karcie wariantu).
      def inherited_json(parent)
        {
          tax_rate: parent.tax_rate.to_i.to_s, parameters: parent.parameters,
          manufacturer: parent.manufacturer.to_s, category_id: parent.category_id.to_s,
          **DESCRIPTIONS.to_h { [ _1, parent[_1].to_s ] },
          **Product::DIMENSIONS.keys.to_h { [ _1, parent.public_send(_1).to_s ] },
          images: images_json(parent)
        }
      end

      # Kategorie do wyboru w karcie produktu: ogólne i katalogu `catalog` (bez - wszystkie, z `catalog_id`, żeby nowy
      # produkt mógł zmienić katalog). `path` to pełna ścieżka „Odzież › Sukienki”.
      def categories_json(catalog = nil)
        all = Category.where(account: Current.account).to_a
        index = all.index_by(&:id)
        all.select { catalog.nil? || _1.catalog_id.nil? || _1.catalog_id == catalog.id }
          .map { { id: _1.id, path: _1.path(index), catalog_id: _1.catalog_id } }.sort_by { _1[:path].downcase }
      end

      def images_json(product)
        product.images.includes(file_attachment: :blob).map do |image|
          { id: image.id, url: rails_blob_path(image.file, disposition: "inline"), name: image.file.filename.to_s }
        end
      end

      # Stan produktu sprzedawalnego w magazynach katalogu.
      def stock_json(product)
        warehouses = Inventory.warehouses(Current.account, catalog: product.catalog).to_a
        items = StockItem.where(product:).index_by(&:warehouse_id)
        {
          warehouses: warehouses.map do |warehouse|
            item = items[warehouse.id]
            { id: warehouse.id, name: warehouse.name, on_hand: item&.on_hand || 0, reserved: item&.reserved || 0,
              strict_control: warehouse.strict_control }
          end
        }
      end

      # Stan „na stanie” z formularza karty ({ warehouse_id => "5" }) w magazynach katalogu, z wpisem w historii.
      # Zwraca błędy pól ({ "stock.<warehouse_id>" => [komunikat] }) - wtedy wcześniejsze magazyny mogły już zostać
      # zmienione, więc wołać w transakcji i wycofać ją przy błędach.
      def apply_stock(product, inputs)
        return {} if inputs.blank?

        ids = Inventory.warehouses(Current.account, catalog: product.catalog).ids.map(&:to_s)
        levels = inputs.permit(*ids).to_h
        invalid = levels.keys.reject { parse_on_hand(levels[_1]) }
        return invalid.to_h { [ "stock.#{_1}", [ "Podaj stan (0 lub więcej)" ] ] } if invalid.any?

        levels.each do |id, value|
          Inventory.set_on_hand!(Current.account, product.id, parse_on_hand(value), warehouse_id: id.to_i, user: Current.user)
        rescue ActiveRecord::RecordInvalid => e
          return { "stock.#{id}" => [ e.record.errors.messages.values.flatten.to_sentence.upcase_first ] }
        rescue Inventory::StrictControl, Inventory::NotSellable => e
          return { "stock.#{id}" => [ e.message ] }
        end
        {}
      end

      def parse_on_hand(value)
        on_hand = Integer(value.to_s.strip, 10, exception: false)
        on_hand if on_hand&.>=(0)
      end

      # Historia stanów i cen oraz aktywne rezerwacje produktu sprzedawalnego albo wszystkich wariantów produktu
      # głównego (wtedy każdy wpis ma nazwę wariantu w `product`).
      def activity_json(product)
        members = product.with_variants? ? product.variants.to_a : [ product ]
        labels = product.with_variants? ? members.to_h { [ _1.id, _1.name ] } : {}
        warehouses = Warehouse.where(account: Current.account).pluck(:id, :name).to_h
        groups = PriceGroup.where(account: Current.account).index_by(&:id)
        movements = Movement.where(product: members).order(id: :desc).limit(HISTORY_LIMIT).to_a
        price_changes = PriceChange.where(product: members).order(id: :desc).limit(HISTORY_LIMIT).to_a
        users = User.where(id: (movements + price_changes).filter_map(&:user_id)).pluck(:id, :name).to_h

        {
          movements: movements.map do |movement|
            { id: movement.id, product: labels[movement.product_id], quantity: movement.quantity, before: movement.on_hand_before,
              after: movement.on_hand_after, reason: REASON_LABELS.fetch(movement.reason), warehouse: warehouses[movement.warehouse_id],
              description: [ movement.holder_label, movement.reference ].compact.join(" · ").presence,
              user: users[movement.user_id], created_at: movement.created_at.iso8601 }
          end,
          priceChanges: price_changes.map do |change|
            group = groups[change.price_group_id]
            { id: change.id, product: labels[change.product_id], priceGroup: group.name,
              before: Inventory.format_price(change.amount_cents_before, group.currency),
              after: Inventory.format_price(change.amount_cents_after || 0, group.currency),
              direction: price_direction(change), user: users[change.user_id], created_at: change.created_at.iso8601 }
          end,
          reservations: Reservation.where(product: members).active.order(:id).map do |reservation|
            { id: reservation.id, product: labels[reservation.product_id], quantity: reservation.quantity,
              warehouse: warehouses[reservation.warehouse_id],
              holder: reservation.holder_label || "#{reservation.holder_type.demodulize} #{reservation.holder_id}",
              created_at: reservation.created_at.iso8601 }
          end,
          limit: HISTORY_LIMIT
        }
      end

      # Trzy rodzaje zmian ceny: ustawienie (wcześniej nie było ceny), podwyżka i obniżka - także usunięcie ceny (do 0).
      def price_direction(change)
        before, after = change.amount_cents_before, change.amount_cents_after.to_i
        return "set" if before.nil?

        after > before ? "up" : "down"
      end

      # Czy któreś źródło zamówień rezerwuje towar (zakładka „Rezerwacje” na karcie).
      def reservations_enabled?
        Inventory.source_settings(Current.account).values.any? { _1[:enabled] }
      end
  end
end
