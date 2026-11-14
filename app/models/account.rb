# Konto firmy (tenant). Każdy rekord biznesowy w systemie ma `account_id`.
class Account < ApplicationRecord
  has_many :memberships, dependent: :destroy
  has_many :users, through: :memberships
  has_many :api_tokens, dependent: :destroy

  validates :name, presence: true
end
