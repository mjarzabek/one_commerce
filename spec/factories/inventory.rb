FactoryBot.define do
  # Produkt prosty: create(:product, price_cents: 10_000, stock: 5) – cena w grupie domyślnej, towar w pierwszym magazynie.
  # Wariant: create(:variant, parent: produkt_główny).
  factory :product, class: "Inventory::Product" do
    account
    catalog { Inventory.default_catalog(account) }
    sequence(:name) { |n| "Produkt #{n}" }
    sequence(:sku) { |n| "SKU-#{n}" }
    tax_rate { 23 }

    transient do
      price_cents { 10_000 }
      stock { 0 }
    end

    after(:build) do |product, ctx|
      if ctx.price_cents
        product.prices.build(account: product.account, price_group: Inventory.default_price_group(product.account),
          amount_cents: ctx.price_cents)
      end
    end

    after(:create) do |product, ctx|
      Inventory.receive!(product.account, product.id, ctx.stock) if ctx.stock.positive?
    end

    # Produkt główny wariantowy (bez własnej ceny).
    factory :main_product do
      price_cents { nil }
    end

    factory :variant do
      parent { association :main_product }
      account { parent.account }
      catalog { parent.catalog }
      sequence(:name) { |n| "Wariant #{n}" }
    end
  end
end
