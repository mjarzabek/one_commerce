# Przynależność użytkownika do konta wraz z rolą.
class Membership < ApplicationRecord
  belongs_to :account
  belongs_to :user

  enum :role, { owner: "owner", admin: "admin", member: "member" }, default: :member, validate: true

  validates :user_id, uniqueness: { scope: :account_id }
end
