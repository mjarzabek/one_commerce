module Inventory
  # Historia cen: zmiana ceny produktu w grupie cenowej (z ilu na ile, kto). Zapisuje ją `Price`.
  # Pusta kwota przed = cena dodana, pusta kwota po = cena usunięta z grupy.
  class PriceChange < ApplicationRecord
    belongs_to :account
    belongs_to :product
    belongs_to :price_group
  end
end
