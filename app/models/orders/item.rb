module Orders
  # Pozycja zamówienia: migawka produktu (SKU, nazwa, cena, VAT) z chwili zamówienia.
  # `product_id` jest pusty dla pozycji spoza katalogu (np. niezmapowana oferta z marketplace'u).
  class Item < ApplicationRecord
    belongs_to :account
    belongs_to :order, inverse_of: :items

    before_validation { self.account ||= order&.account }
    before_validation :calculate_total

    validates :name, presence: true
    validates :quantity, numericality: { only_integer: true, greater_than: 0 }
    validates :unit_price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

    def calculate_total
      self.total_cents = quantity.to_i * unit_price_cents.to_i
    end
  end
end
