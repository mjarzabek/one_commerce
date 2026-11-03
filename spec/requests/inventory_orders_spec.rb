require "rails_helper"

# Styk Produktów (stany) z zamówieniami - scenariusze obejmujące kilka pakietów Core.
RSpec.describe "Produkty i zamówienia", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }
  let(:mug) { create(:product, account:, name: "Kubek") }

  before { sign_in(user) }

  it "usuwa produkt z zamówienia - pozycja zostaje z nazwą, SKU i ceną, bez powiązania z produktem" do
    Inventory.update_source_setting!(account, :manual, enabled: false)
    order = Orders.create_from(account:, source: :manual, items: [ { product_id: mug.id, quantity: 1 } ])

    delete "/inventory/products/#{mug.id}"

    expect(Inventory.products(account)).to be_empty
    item = order.items.reload.sole
    expect([ item.product_id, item.name, item.sku, item.unit_price_cents ]).to eq([ nil, "Kubek", mug.sku, 10_000 ])
  end
end
