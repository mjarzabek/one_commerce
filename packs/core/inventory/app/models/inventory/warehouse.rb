module Inventory
  # Magazyn konta – fizyczne miejsce składowania (np. „Punkt X”). Katalogi wybierają, z których magazynów
  # korzystają, a źródła zamówień – z którego magazynu schodzi towar.
  class Warehouse < ApplicationRecord
    belongs_to :account
    has_many :catalog_warehouses, dependent: :restrict_with_error
    has_many :catalogs, through: :catalog_warehouses
    has_many :stock_items, dependent: :restrict_with_error

    validates :name, presence: true, uniqueness: { scope: :account_id }
  end
end
