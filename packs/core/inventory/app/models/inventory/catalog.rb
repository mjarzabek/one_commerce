module Inventory
  # Katalog produktów (np. „Odzież”, „Hurt”). Produkt należy do jednego katalogu, SKU jest unikalne w katalogu.
  # Katalog korzysta z wybranych magazynów konta (stan łączny produktu to suma tych magazynów)
  # i wybranych grup cenowych (produkty katalogu mają ceny w tych grupach).
  class Catalog < ApplicationRecord
    belongs_to :account
    has_many :products, dependent: :restrict_with_error
    has_many :catalog_warehouses, dependent: :delete_all, inverse_of: :catalog, autosave: true
    has_many :warehouses, -> { order(:position, :id) }, through: :catalog_warehouses
    has_many :catalog_price_groups, dependent: :delete_all, inverse_of: :catalog, autosave: true

    validates :name, presence: true, uniqueness: { scope: :account_id }
    validate :has_warehouse
    validate :has_price_group
    validate :warehouses_from_account
    validate :removed_warehouses_empty, on: :update

    # Zaznaczone magazyny z formularza katalogu. Zmiany trafiają do bazy dopiero przy zapisie (po walidacji).
    def warehouse_ids=(ids)
      ids = Array(ids).compact_blank.map(&:to_i).uniq
      catalog_warehouses.each { _1.mark_for_destruction unless ids.include?(_1.warehouse_id) }
      (ids - catalog_warehouses.map(&:warehouse_id)).each { catalog_warehouses.build(warehouse_id: _1) }
    end

    def warehouse_ids
      catalog_warehouses.reject(&:marked_for_destruction?).map(&:warehouse_id)
    end

    # Zaznaczone grupy cenowe z formularza katalogu. Odznaczenie grupy nie kasuje cen produktów – tylko je ukrywa.
    def price_group_ids=(ids)
      ids = Array(ids).compact_blank.map(&:to_i).uniq
      catalog_price_groups.each { _1.mark_for_destruction unless ids.include?(_1.price_group_id) }
      (ids - catalog_price_groups.map(&:price_group_id)).each { catalog_price_groups.build(price_group_id: _1) }
    end

    def price_group_ids
      catalog_price_groups.reject(&:marked_for_destruction?).map(&:price_group_id)
    end

    private
      def has_warehouse
        errors.add(:warehouse_ids, "Wybierz co najmniej jeden magazyn") if warehouse_ids.empty?
      end

      def has_price_group
        errors.add(:price_group_ids, "Wybierz co najmniej jedną grupę cenową") if price_group_ids.empty?
      end

      def warehouses_from_account
        foreign = catalog_warehouses.map(&:warehouse).compact.reject { _1.account_id == account_id }
        errors.add(:warehouse_ids, "Magazyn nie należy do konta") if foreign.any?
        foreign_groups = catalog_price_groups.map(&:price_group).compact.reject { _1.account_id == account_id }
        errors.add(:price_group_ids, "Grupa cenowa nie należy do konta") if foreign_groups.any?
      end

      # Nie odpinamy magazynu, w którym produkty z katalogu mają towar – ten stan zniknąłby ze stanu łącznego.
      def removed_warehouses_empty
        removed = catalog_warehouses.select(&:marked_for_destruction?).map(&:warehouse_id)
        return if removed.empty?

        busy = StockItem.joins(:product).where(warehouse_id: removed, product: { catalog_id: id })
          .where("on_hand > 0 OR reserved > 0").distinct.pluck(:warehouse_id)
        return if busy.empty?

        names = Warehouse.where(id: busy).pluck(:name).join(", ")
        errors.add(:warehouse_ids, "Nie można odznaczyć magazynu z towarem produktów z tego katalogu: #{names}")
      end
  end
end
