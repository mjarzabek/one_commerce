require "rails_helper"

# Styk Produktów (stany) z zamówieniami - scenariusze obejmujące kilka pakietów Core.
RSpec.describe "Produkty i zamówienia", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }
  let(:mug) { create(:product, account:, name: "Kubek") }

  before { sign_in(user) }

  it "nie usuwa produktu, który jest w zamówieniu (także bez rezerwacji)" do
    Inventory.update_source_setting!(account, :manual, enabled: false)
    Orders.create_from(account:, source: :manual, items: [ { product_id: mug.id, quantity: 1 } ])

    delete "/inventory/products/#{mug.id}"

    expect(flash[:alert]).to include("Zarchiwizowany")
    expect(Inventory.products(account).map(&:name)).to include("Kubek")
  end
end
