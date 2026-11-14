module Inventory
  class Price < ApplicationRecord
    belongs_to :account
    belongs_to :product, inverse_of: :prices
    belongs_to :price_group

    before_validation { self.account ||= product&.account }

    validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

    # Każda zmiana ceny trafia do historii (autor: zalogowany użytkownik, bez niego - system).
    after_create { record_change(nil, amount_cents) }
    after_update { record_change(*saved_change_to_amount_cents) if saved_change_to_amount_cents? }
    after_destroy { record_change(amount_cents, nil) }

    private
      def record_change(before, after)
        PriceChange.create!(account_id:, product_id:, price_group_id:, amount_cents_before: before, amount_cents_after: after,
          user_id: Current.user&.id)
      end
  end
end
