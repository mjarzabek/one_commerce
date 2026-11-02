module Inventory
  # Grupa cenowa (np. „Detal PL”, „Allegro”, „EU” w EUR). Katalog wybiera, z których grup korzysta;
  # produkty katalogu mają ceny w tych grupach. Grupa domyślna konta obsługuje Live i zamówienia ręczne.
  class PriceGroup < ApplicationRecord
    CURRENCIES = %w[PLN EUR CZK USD GBP].freeze

    belongs_to :account
    has_many :prices, dependent: :delete_all
    has_many :catalog_price_groups, dependent: :delete_all
    has_many :catalogs, through: :catalog_price_groups

    validates :name, presence: true, uniqueness: { scope: :account_id }
    validates :currency, inclusion: { in: CURRENCIES }

    scope :ordered, -> { order(default: :desc, position: :asc, id: :asc) }

    # Jedna grupa domyślna w koncie.
    def make_default!
      transaction do
        PriceGroup.where(account_id:).where.not(id:).update_all(default: false)
        update!(default: true)
      end
    end
  end
end
