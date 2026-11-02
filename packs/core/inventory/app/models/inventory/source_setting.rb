module Inventory
  # Ustawienia źródła zamówień (live / ecommerce / manual): z którego magazynu schodzi towar
  # i czy zamówienie rezerwuje go od razu (true), czy dopiero zdejmuje przy wysyłce.
  class SourceSetting < ApplicationRecord
    SOURCES = %w[live ecommerce manual].freeze

    belongs_to :account
    belongs_to :warehouse, optional: true

    validates :source, inclusion: { in: SOURCES }, uniqueness: { scope: :account_id }
    validate :warehouse_from_account

    private
      def warehouse_from_account
        errors.add(:warehouse, "nie należy do konta") if warehouse && warehouse.account_id != account_id
      end
  end
end
