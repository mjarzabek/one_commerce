module Inventory
  # Wspólna baza ekranów Magazynu: dostęp z panelem zamówień, domyślna konfiguracja konta, wybór katalogu
  # i bloki karty produktu (ceny, stany w magazynach, historia ruchów).
  class BaseController < InertiaController
    REASON_LABELS = { "receipt" => "Przyjęcie", "adjustment" => "Korekta", "sale" => "Sprzedaż", "return" => "Zwrot" }.freeze

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

      # Grupy cenowe konta albo – z `catalog` – grupy, z których korzysta katalog.
      def price_groups(catalog = nil)
        Inventory.price_groups(Current.account, catalog:)
      end

      def price_groups_json(catalog = nil)
        price_groups(catalog).map { { id: _1.id, name: _1.name, currency: _1.currency, default: _1.default } }
      end

      def redirect_with_errors(record, to: request.referer || inventory_root_path)
        redirect_to to, inertia: { errors: inertia_errors(record) }
      end

      # Ceny produktu do pól formularza: { "price_group_id" => "199,90" } – wszystkie grupy konta
      # (formularz pokazuje tylko grupy katalogu produktu).
      def price_inputs_json(product)
        price_groups.to_h { |group| [ group.id.to_s, format_input(product.price_cents_in(group.id)) ] }
      end

      # Ceny z formularza tylko dla grup, z których korzysta katalog produktu.
      def catalog_price_inputs(inputs, catalog)
        inputs.to_h.slice(*price_groups(catalog).map { _1.id.to_s })
      end

      def format_input(cents)
        cents && format("%.2f", cents / 100.0).tr(".", ",")
      end

      # Stan w magazynach katalogu, aktywne rezerwacje i historia ruchów produktu sprzedawalnego.
      def stock_json(product)
        warehouses = Inventory.warehouses(Current.account, catalog: product.catalog).to_a
        names = Warehouse.where(account: Current.account).pluck(:id, :name).to_h
        items = StockItem.where(product:).index_by(&:warehouse_id)
        movements = Movement.where(product:).order(id: :desc).limit(50).to_a
        users = User.where(id: movements.filter_map(&:user_id)).pluck(:id, :name).to_h

        {
          warehouses: warehouses.map do |warehouse|
            item = items[warehouse.id]
            { id: warehouse.id, name: warehouse.name, on_hand: item&.on_hand || 0, reserved: item&.reserved || 0 }
          end,
          reservations: Reservation.where(product:).active.order(:id).map do |reservation|
            { id: reservation.id, quantity: reservation.quantity, warehouse: names[reservation.warehouse_id],
              holder: reservation.holder_label || "#{reservation.holder_type.demodulize} #{reservation.holder_id}",
              created_at: reservation.created_at.iso8601 }
          end,
          movements: movements.map do |movement|
            { id: movement.id, quantity: movement.quantity, before: movement.on_hand_before, after: movement.on_hand_after,
              reason: REASON_LABELS.fetch(movement.reason), warehouse: names[movement.warehouse_id],
              description: [ movement.holder_label, movement.reference ].compact.join(" · ").presence,
              user: users[movement.user_id], created_at: movement.created_at.iso8601 }
          end
        }
      end
  end
end
