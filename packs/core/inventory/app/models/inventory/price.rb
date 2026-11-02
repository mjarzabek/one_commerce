module Inventory
  class Price < ApplicationRecord
    belongs_to :account
    belongs_to :product, inverse_of: :prices
    belongs_to :price_group

    before_validation { self.account ||= product&.account }

    validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  end
end
