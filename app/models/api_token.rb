# Token publicznego REST API. W bazie trzymamy tylko skrót SHA256;
# pełna wartość jest pokazywana klientowi jeden raz, przy utworzeniu.
class ApiToken < ApplicationRecord
  PREFIX = "one_"

  belongs_to :account

  validates :name, :token_digest, presence: true

  scope :active, -> { where(revoked_at: nil) }

  def self.issue!(account:, name:, scopes: [])
    raw = PREFIX + SecureRandom.base58(40)
    token = create!(account:, name:, scopes:, token_digest: digest(raw), token_hint: raw.last(4))
    [ token, raw ]
  end

  def self.find_by_raw(raw)
    return if raw.blank?

    active.find_by(token_digest: digest(raw))
  end

  def self.digest(raw)
    OpenSSL::Digest::SHA256.hexdigest(raw)
  end

  def allows?(scope)
    scopes.include?("*") || scopes.include?(scope.to_s)
  end

  def revoke!
    update!(revoked_at: Time.current)
  end
end
