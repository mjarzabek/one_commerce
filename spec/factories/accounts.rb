FactoryBot.define do
  factory :account do
    sequence(:name) { |n| "Konto #{n}" }
  end

  factory :user do
    sequence(:name) { |n| "Użytkownik #{n}" }
    sequence(:email_address) { |n| "user#{n}@example.com" }
    password { "password123" }

    # Użytkownik z kontem (rola: właściciel) i opcjonalnymi modułami.
    transient do
      account { nil }
      modules { [] }
    end

    after(:create) do |user, ctx|
      account = ctx.account || create(:account)
      account.memberships.create!(user:, role: :owner)
      ctx.modules.each { |mod| Licensing.grant!(account, mod) }
    end
  end
end
