module Inventory
  # Stan wariantu w jednym magazynie: ile sztuk fizycznie jest (on_hand) i ile z nich jest zarezerwowanych.
  class StockItem < ApplicationRecord
    belongs_to :account
    belongs_to :warehouse
    belongs_to :product

    validates :on_hand, :reserved, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
    validate :reserved_within_on_hand

    def available
      on_hand - reserved
    end

    private
      def reserved_within_on_hand
        return if reserved.to_i <= on_hand.to_i

        errors.add(:on_hand, "nie może być mniejszy niż liczba zarezerwowanych sztuk (#{reserved})")
      end
  end
end
