module Inventory
  # Produkt w katalogu.
  #
  # - Produkt prosty: bez rodzica i bez wariantów - ma SKU, EAN, ceny i stany.
  # - Produkt wariantowy: produkt główny (może mieć własne SKU i EAN) z wariantami (`variants`).
  #   Ceny i stany mają warianty; stan produktu głównego to suma wariantów.
  # - Wariant: produkt z `parent` - pełnoprawny produkt z własną nazwą wariantu (np. „M”), SKU, EAN, statusem, cenami
  #   i stanami. VAT, opisy, wymiary i waga są dziedziczone z produktu głównego, gdy na wariancie są puste (NULL)
  #   (`effective`). Parametry i zdjęcia to własne wariantu + odziedziczone (`effective_parameters`, `effective_images`).
  #
  # ID produktów zaczynają się od 110 000 000 (migracja StartInventoryProductIdsAt110000000).
  class Product < ApplicationRecord
    TAX_RATES = [ 23, 8, 5, 0 ].freeze
    DEFAULT_TAX_RATE = 23
    # Pola, które wariant dziedziczy z produktu głównego, dopóki nie ustawi własnej wartości.
    INHERITED = %i[tax_rate manufacturer category_id description description_extra_1 description_extra_2 description_extra_3
                   length_mm width_mm height_mm weight_grams].freeze
    STATUS_LABELS = { "active" => "Aktywny", "draft" => "Szkic" }.freeze
    # Wymiary i waga w formularzu: cm i kg („12,5”, „0,35”); w bazie milimetry i gramy.
    DIMENSIONS = { length_cm: [ :length_mm, 10 ], width_cm: [ :width_mm, 10 ], height_cm: [ :height_mm, 10 ],
                   weight_kg: [ :weight_grams, 1000 ] }.freeze

    belongs_to :account
    belongs_to :catalog
    belongs_to :parent, class_name: "Product", optional: true, inverse_of: :variants
    # Kategoria ogólna albo katalogu produktu. Producent (`manufacturer`) to zwykły tekst.
    belongs_to :category, optional: true
    has_many :variants, -> { order(:position, :id) }, class_name: "Product", foreign_key: :parent_id,
      dependent: :restrict_with_error, inverse_of: :parent
    has_many :prices, dependent: :delete_all, inverse_of: :product, autosave: true
    has_many :images, -> { order(:position, :id) }, class_name: "ProductImage", dependent: :destroy, inverse_of: :product

    enum :status, { draft: "draft", active: "active" }, default: :active, validate: true

    attr_readonly :catalog_id, :parent_id

    normalizes :sku, :ean, :manufacturer, with: ->(value) { value.squish.presence }

    before_validation do
      if parent
        self.account ||= parent.account
        self.catalog_id ||= parent.catalog_id
      elsif new_record?
        self.tax_rate ||= DEFAULT_TAX_RATE
      end
    end

    validates :name, presence: true
    validates :sku, uniqueness: { scope: :catalog_id }, allow_nil: true
    validates :sku, presence: { message: "jest wymagane" }, if: :sellable?
    validates :tax_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true
    validates :tax_rate, presence: true, unless: :variant?
    validate :price_inputs_parsable
    validate :dimension_inputs_parsable
    validate :parameters_complete
    validate :parent_is_main_product
    validate :parent_without_stock, on: :create, if: :variant?
    validate :catalog_from_account
    validate :category_from_catalog

    scope :main, -> { where(parent_id: nil) }
    # Produkty z własnymi cenami i stanami: warianty i produkty proste (bez wariantów).
    scope :sellable, -> do
      where("inventory_products.parent_id IS NOT NULL OR NOT EXISTS " \
            "(SELECT 1 FROM inventory_products v WHERE v.parent_id = inventory_products.id)")
    end

    # --- Rodzina produktu (produkt główny + warianty) -------------------------------------------
    # „Pasuje produkt albo któryś z jego wariantów” = id produktu głównego pasujących rekordów.
    MAIN_ID = Arel.sql("COALESCE(parent_id, id)")
    MATCHABLE = %w[name sku ean].freeze

    scope :family_of, ->(products) { where(id: products.select(MAIN_ID)) }
    scope :matching, ->(column, text) do
      raise ArgumentError, "Nieobsługiwana kolumna: #{column}" unless MATCHABLE.include?(column.to_s)

      family_of(unscoped.where(arel_table[column].matches("%#{sanitize_sql_like(text)}%")))
    end
    # Wyszukiwarka listy: nazwa zawiera tekst albo ID zaczyna się od wpisanych cyfr.
    scope :search, ->(text) do
      matches = unscoped.where(arel_table[:name].matches("%#{sanitize_sql_like(text)}%"))
      digits = text.gsub(/[[:space:]]/, "")
      matches = matches.or(unscoped.where("inventory_products.id::text LIKE ?", "#{digits}%")) if digits.match?(/\A\d{1,19}\z/)
      family_of(matches)
    end
    scope :with_variants, -> { where(id: unscoped.where.not(parent_id: nil).select(:parent_id)) }
    scope :without_variants, -> { where.not(id: unscoped.where.not(parent_id: nil).select(:parent_id)) }
    # Którakolwiek cena w rodzinie w grupie cenowej mieści się w zakresie (końce mogą być otwarte: `100..`, `..500`).
    scope :priced_between, ->(price_group, range) do
      family_of(unscoped.where(id: Price.where(price_group:, amount_cents: range).select(:product_id)))
    end

    # Stan rodziny w podanych magazynach (`stock_value`) i najniższa cena rodziny w grupie (`min_price`),
    # liczone raz na produkt - można po nich filtrować i sortować (`family_stock.value`, `family_price.min`).
    scope :with_family_metrics, ->(warehouse_ids:, price_group:) do
      family = unscoped.from("inventory_products family")
        .where("family.id = inventory_products.id OR family.parent_id = inventory_products.id").select("family.id")
      stock = StockItem.where(warehouse_id: warehouse_ids, product_id: family).select("COALESCE(SUM(on_hand - reserved), 0) AS value")
      price = Price.where(price_group:, product_id: family).select("MIN(amount_cents) AS min")

      joins("LEFT JOIN LATERAL (#{stock.to_sql}) family_stock ON true")
        .joins("LEFT JOIN LATERAL (#{price.to_sql}) family_price ON true")
        .select("inventory_products.*, family_stock.value AS stock_value, family_price.min AS min_price")
    end
    # Wymaga `with_family_metrics`.
    scope :stocked_between, ->(range) { where(Arel.sql("family_stock.value").between(range)) }

    # Także wariant budowany razem z nowym produktem głównym (bez `parent_id` przed zapisem).
    def variant? = parent_id.present? || parent.present?
    def with_variants? = !variant? && variants.any?

    # Produkt, który ma własne ceny i stany: prosty albo wariant.
    def sellable? = variant? || !with_variants?

    def main_product = parent || self

    def display_name
      variant? ? "#{parent.name} - #{name}" : name
    end

    # Wartość pola z dziedziczeniem: własna wariantu albo (gdy pusta) produktu głównego.
    def effective(attribute)
      raise ArgumentError, "Pole nie jest dziedziczone: #{attribute}" unless INHERITED.include?(attribute.to_sym)

      value = self[attribute]
      value.nil? && variant? ? parent[attribute] : value
    end

    def effective_tax_rate = effective(:tax_rate)

    # Parametry produktu głównego, w których wariant nadpisuje wartości (ta sama nazwa), oraz własne parametry wariantu.
    def effective_parameters
      return parameters unless variant?

      own = parameters.index_by { _1["name"].downcase }
      inherited = parent.parameters.map { own.delete(_1["name"].downcase) || _1 }
      inherited + own.values
    end

    # Parametry produktu głównego, których wariant nie nadpisuje.
    def inherited_parameters
      return [] unless variant?

      own = parameters.map { _1["name"].downcase }
      parent.parameters.reject { own.include?(_1["name"].downcase) }
    end

    # Zdjęcia wariantu, a po nich zdjęcia produktu głównego (pierwsze = główne).
    def effective_images
      variant? ? images.to_a + parent.images.to_a : images.to_a
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
          @price_errors[group_id] = "Nieprawidłowa kwota - wpisz np. 199,99"
        end
      end
    end

    def price_cents_in(price_group_id)
      prices.find { _1.price_group_id == price_group_id && !_1.marked_for_destruction? }&.amount_cents
    end

    DIMENSIONS.each do |input, (column, factor)|
      define_method(input) do
        value = self[column]
        value && (value.to_d / factor).to_s("F").sub(/\.?0+\z/, "").tr(".", ",")
      end

      define_method(:"#{input}=") do |raw|
        (@dimension_errors ||= {}).delete(input)
        text = raw.to_s.gsub(/[[:space:]]/, "").tr(",", ".")
        if text.empty?
          self[column] = nil
        elsif text.match?(/\A\d+(\.\d+)?\z/)
          self[column] = (text.to_d * factor).round
        else
          @dimension_errors[input] = "Podaj liczbę, np. 12,5"
        end
      end
    end

    # Parametry: [{ "name" => "Materiał", "value" => "bawełna" }, …]. Wiersze bez nazwy i wartości są pomijane.
    def parameters=(rows)
      rows = rows.values if rows.respond_to?(:values) && !rows.is_a?(Array)
      super(Array(rows).filter_map do |row|
        row = row.to_h.stringify_keys
        name, value = row["name"].to_s.strip, row["value"].to_s.strip
        { "name" => name, "value" => value } unless name.empty? && value.empty?
      end)
    end

    private
      def price_inputs_parsable
        @price_errors.to_h.each { |group_id, message| errors.add(:"prices.#{group_id}", message) }
      end

      def dimension_inputs_parsable
        @dimension_errors.to_h.each { |input, message| errors.add(input, message) }
      end

      def parameters_complete
        parameters.each_with_index do |row, index|
          errors.add(:"parameters.#{index}.name", "Podaj nazwę parametru") if row["name"].empty?
          errors.add(:"parameters.#{index}.value", "Podaj wartość parametru") if row["value"].empty?
        end
      end

      def parent_is_main_product
        return unless parent

        errors.add(:parent, "nie może być wariantem") if parent.variant?
        errors.add(:parent, "należy do innego konta") if parent.account_id != account_id
      end

      # Produkt prosty z towarem nie może dostać wariantów - stan musiałby „zniknąć” z produktu głównego.
      def parent_without_stock
        return unless parent&.persisted? && parent.variants.where.not(id: nil).none?
        return unless StockItem.where(product_id: parent.id).where("on_hand > 0 OR reserved > 0").exists?

        errors.add(:base, "Produkt „#{parent.name}” ma towar na stanie - wyzeruj jego stan, zanim dodasz warianty")
      end

      def catalog_from_account
        errors.add(:catalog, "nie należy do konta") if catalog && catalog.account_id != account_id
      end

      def category_from_catalog
        return unless category && will_save_change_to_category_id?

        if category.account_id != account_id
          errors.add(:category_id, "Kategoria nie należy do konta")
        elsif !category.general? && category.catalog_id != catalog_id
          errors.add(:category_id, "Kategoria należy do innego katalogu")
        end
      end
  end
end
