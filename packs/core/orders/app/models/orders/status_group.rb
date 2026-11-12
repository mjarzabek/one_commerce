module Orders
  # Grupa statusów na liście zamówień (np. „Do realizacji”). Usunięcie grupy zostawia jej statusy bez grupy.
  class StatusGroup < ApplicationRecord
    belongs_to :account
    has_many :statuses, -> { order(:position, :id) }, foreign_key: :group_id, inverse_of: :group, dependent: :nullify

    validates :name, presence: true, uniqueness: { scope: :account_id }

    scope :ordered, -> { order(:position, :id) }

    before_create { self.position = (StatusGroup.where(account_id:).maximum(:position) || -1) + 1 }
  end
end
