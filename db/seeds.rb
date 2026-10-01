# Dane demonstracyjne: `bin/rails db:seed`
#
# Trzy konta pokazują różne pakiety:
#   one@example.com          – pakiet ONE (wszystkie moduły)
#   live@example.com         – tylko Live (z panelem zamówień)
#   chat@example.com         – tylko Chat (bez panelu zamówień)
# Hasło dla wszystkich: password123

def demo_account(email, account_name:, user_name:)
  existing = User.find_by(email_address: email)
  return Accounts.default_account_for(existing) if existing

  Accounts.create_with_owner!(account_name:, user_name:, email_address: email, password: "password123")
end

one = demo_account("one@example.com", account_name: "Butik Demo ONE", user_name: "Anna Nowak")
Licensing.grant_bundle!(one, :one)

live = demo_account("live@example.com", account_name: "Butik Live", user_name: "Kasia Live")
Licensing.grant!(live, :live, trial_days: Licensing::TRIAL_DAYS)

chat = demo_account("chat@example.com", account_name: "Sklep Chat", user_name: "Marek Chat")
Licensing.grant!(chat, :chat)

unless one.api_tokens.exists?
  _token, raw = Accounts.issue_api_token!(account: one, name: "Demo", scopes: %w[orders:read])
  puts "Token API dla one@example.com: #{raw}"
end

puts "Konta demo gotowe. Hasło: password123"
