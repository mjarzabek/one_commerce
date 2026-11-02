FactoryBot.define do
  factory :customer, class: "Customers::Customer" do
    account
    sequence(:name) { |n| "Klient #{n}" }
    sequence(:email) { |n| "klient#{n}@example.com" }
  end
end
