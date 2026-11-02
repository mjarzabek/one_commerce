module Inventory
  # Rezerwacja sztuk w konkretnym magazynie dla „posiadacza” (zamówienie, koszyk Live…).
  # Posiadacz jest zapisany jako para holder_type/holder_id, bez zależności od jego pakietu.
  class Reservation < ApplicationRecord
    belongs_to :account
    belongs_to :warehouse
    belongs_to :product

    enum :status, { active: "active", fulfilled: "fulfilled", released: "released" }, default: :active, validate: true

    validates :quantity, numericality: { only_integer: true, greater_than: 0 }
    validates :holder_type, :holder_id, presence: true

    scope :held_by, ->(holder) { where(holder_type: holder.class.name, holder_id: holder.id) }
  end
end
