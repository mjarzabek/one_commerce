module Inventory
  # Produkt w katalogu.
  #
  # - Produkt prosty: bez rodzica i bez wariantów – ma SKU, EAN, ceny i stany.
  # - Produkt wariantowy: produkt główny (może mieć własne SKU i EAN) z wariantami (`variants`).
  #   Ceny i stany mają warianty; stan produktu głównego to suma wariantów.
  # - Wariant: produkt z `parent` – ma własną nazwę wariantu (np. „M”), SKU, EAN, ceny i stany.
  class Product < ApplicationRecord
    TAX_RATES = [ 23, 8, 5, 0 ].freeze
    STATUS_LABELS = { "active" => "Aktywny", "draft" => "Szkic", "archived" => "Zarchiwizowany" }.freeze

    belongs_to :account
    belongs_to :catalog
    belongs_to :parent, class_name: "Product", optional: true, inverse_of: :variants
    has_many :variants, -> { order(:position, :id) }, class_name: "Product", foreign_key: :parent_id,
      dependent: :restrict_with_error, inverse_of: :parent
    has_many :prices, dependent: :delete_all, inverse_of: :product, autosave: true

    enum :status, { draft: "draft", active: "active", archived: "archived" }, default: :active, validate: true

    attr_readonly :catalog_id, :parent_id

    normalizes :sku, :ean, with: ->(value) { value.strip.presence }

    before_validation do
      if parent
        self.account ||= parent.account
        self.catalog_id ||= parent.catalog_id
      end
    end

    validates :name, presence: true
    validates :sku, uniqueness: { scope: :catalog_id }, allow_nil: true
    validates :sku, presence: { message: "jest wymagane" }, if: :sellable?
    validates :tax_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
    validate :price_inputs_parsable
    validate :parent_is_main_product
    validate :parent_without_stock, on: :create, if: :variant?
    validate :catalog_from_account

    scope :main, -> { where(parent_id: nil) }
    # Produkty z własnymi cenami i stanami: warianty i produkty proste (bez wariantów).
    scope :sellable, -> do
      where("inventory_products.parent_id IS NOT NULL OR NOT EXISTS " \
            "(SELECT 1 FROM inventory_products v WHERE v.parent_id = inventory_products.id)")
    end
    scope :search, ->(query) do
      pattern = "%#{sanitize_sql_like(query)}%"
      where("inventory_products.name ILIKE :pattern OR inventory_products.sku ILIKE :pattern OR inventory_products.ean ILIKE :pattern " \
            "OR EXISTS (SELECT 1 FROM inventory_products v WHERE v.parent_id = inventory_products.id " \
            "AND (v.name ILIKE :pattern OR v.sku ILIKE :pattern OR v.ean ILIKE :pattern))", pattern:)
    end

    def variant? = parent_id.present?
    def with_variants? = !variant? && variants.any?

    # Produkt, który ma własne ceny i stany: prosty albo wariant.
    def sellable? = variant? || !with_variants?

    def main_product = parent || self

    def display_name
      variant? ? "#{parent.name} – #{name}" : name
    end

    def effective_tax_rate
      variant? ? parent.tax_rate : tax_rate
    end

    # Ceny z formularza: { price_group_id => "199,90" }. Puste pole = brak ceny w tej grupie.
    def price_inputs=(inputs)
      @price_errors = {}
      inputs.to_h.each do |group_id, value|
        group_id = group_id.to_i
        price = prices.find { _1.price_group_id == group_id }
        if value.to_s.strip.empty?
          price&.mark_for_destruction
        elsif (cents = Inventory.parse_money(value))
          price ||= prices.build(price_group_id: group_id, account:)
          price.amount_cents = cents
        else
          @price_errors[group_id] = "Nieprawidłowa kwota – wpisz np. 199,99"
        end
      end
    end

    def price_cents_in(price_group_id)
      prices.find { _1.price_group_id == price_group_id && !_1.marked_for_destruction? }&.amount_cents
    end

    private
      def price_inputs_parsable
        @price_errors.to_h.each { |group_id, message| errors.add(:"prices.#{group_id}", message) }
      end

      def parent_is_main_product
        return unless parent

        errors.add(:parent, "nie może być wariantem") if parent.variant?
        errors.add(:parent, "należy do innego konta") if parent.account_id != account_id
      end

      # Produkt prosty z towarem nie może dostać wariantów – stan musiałby „zniknąć” z produktu głównego.
      def parent_without_stock
        return unless parent&.persisted? && parent.variants.where.not(id: nil).none?
        return unless StockItem.where(product_id: parent.id).where("on_hand > 0 OR reserved > 0").exists?

        errors.add(:base, "Produkt „#{parent.name}” ma towar na stanie – wyzeruj jego stan, zanim dodasz warianty")
      end

      def catalog_from_account
        errors.add(:catalog, "nie należy do konta") if catalog && catalog.account_id != account_id
      end
  end
end
