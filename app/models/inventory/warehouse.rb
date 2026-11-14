module Inventory
  # Magazyn konta - fizyczne miejsce składowania (np. „Punkt X”). Katalogi wybierają, z których magazynów
  # korzystają, a źródła zamówień - z którego magazynu schodzi towar.
  # `strict_control` - ścisła kontrola magazynowa: stan zmieniają tylko dokumenty magazynowe (i zamówienia),
  # bez ręcznej edycji. Bez niej stan to zwykłe pole edytowalne na karcie produktu.
  class Warehouse < ApplicationRecord
    belongs_to :account
    has_many :catalog_warehouses, dependent: :restrict_with_error
    has_many :catalogs, through: :catalog_warehouses
    has_many :stock_items, dependent: :restrict_with_error

    validates :name, presence: true, uniqueness: { scope: :account_id }
  end
end
