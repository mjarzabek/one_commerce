# Licencja jednego modułu dla konta. Pakiet ONE to po prostu trzy licencje.
class ModuleLicense < ApplicationRecord
  belongs_to :account

  enum :module_key, { live: "live", multichannel: "multichannel", chat: "chat" }, validate: true
  enum :status, { trialing: "trialing", active: "active", expired: "expired", cancelled: "cancelled" },
    default: :trialing, validate: true

  validates :module_key, uniqueness: { scope: :account_id }

  scope :usable, -> { where(status: %w[trialing active]) }

  def usable?
    return false unless trialing? || active?
    return trial_ends_at.nil? || trial_ends_at.future? if trialing?

    true
  end
end
