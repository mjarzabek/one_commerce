module Inventory
  class CatalogWarehouse < ApplicationRecord
    belongs_to :catalog, inverse_of: :catalog_warehouses
    belongs_to :warehouse
  end
end
