module Inventory
  class CatalogPriceGroup < ApplicationRecord
    belongs_to :catalog, inverse_of: :catalog_price_groups
    belongs_to :price_group
  end
end
