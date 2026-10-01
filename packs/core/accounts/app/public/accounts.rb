# Publiczne API pakietu accounts.
module Accounts
  # Zwraca konto, w kontekście którego działa użytkownik.
  # MVP: pierwsze konto użytkownika; przełącznik kont dojdzie później.
  def self.default_account_for(user)
    user&.accounts&.order(:created_at)&.first
  end

  # Uwierzytelnia token API i zwraca [konto, token] albo nil.
  def self.authenticate_api_token(raw)
    token = ApiToken.find_by_raw(raw)
    return unless token

    token.touch(:last_used_at)
    [ token.account, token ]
  end

  # Tworzy konto z właścicielem (rejestracja, seedy).
  def self.create_with_owner!(account_name:, user_name:, email_address:, password:)
    ApplicationRecord.transaction do
      account = Account.create!(name: account_name)
      user = User.create!(name: user_name, email_address:, password:)
      account.memberships.create!(user:, role: :owner)
      account
    end
  end

  def self.issue_api_token!(account:, name:, scopes: [])
    ApiToken.issue!(account:, name:, scopes:)
  end
end
