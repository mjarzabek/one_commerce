module Customers
  # Tożsamość klienta w kanale, np. profil FB z komentarza na transmisji albo login Allegro.
  class Identity < ApplicationRecord
    CHANNELS = %w[facebook instagram allegro email shop].freeze

    belongs_to :account
    belongs_to :customer, inverse_of: :identities

    before_validation { self.account ||= customer&.account }

    validates :channel, inclusion: { in: CHANNELS }
    validates :external_id, presence: true, uniqueness: { scope: %i[account_id channel] }
  end
end
