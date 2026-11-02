module Inventory
  # Historia zmian stanu fizycznego. Suma `quantity` dla wariantu w magazynie = on_hand.
  class Movement < ApplicationRecord
    belongs_to :account
    belongs_to :warehouse
    belongs_to :product

    enum :reason, { receipt: "receipt", adjustment: "adjustment", sale: "sale", return: "return" },
      validate: true, prefix: true

    validates :quantity, numericality: { only_integer: true, other_than: 0 }

    scope :held_by, ->(holder) { where(holder_type: holder.class.name, holder_id: holder.id) }
  end
end
