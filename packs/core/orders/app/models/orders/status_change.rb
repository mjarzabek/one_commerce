module Orders
  # Historia statusów zamówienia: kto, kiedy i z jakiego statusu na jaki.
  class StatusChange < ApplicationRecord
    belongs_to :account
    belongs_to :order, inverse_of: :status_changes

    before_validation { self.account ||= order&.account }

    validates :to_status, presence: true
  end
end
