require "rails_helper"

RSpec.describe "Panel zamówień", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }

  before { sign_in(user) }

  it "pokazuje zamówienia konta z etykietami po polsku" do
    Orders.create_from(account:, source: :manual, customer: { name: "Jan Nowak" },
      items: [ { name: "Usługa", quantity: 1, unit_price_cents: 123_450 } ])

    get "/orders"

    expect_inertia.to render_component("core/orders/index")
    order = inertia.props[:orders].sole
    expect(order).to include("source" => "Ręczne", "customer" => "Jan Nowak", "status" => "Nowe", "total" => "1 234,50 PLN")
  end
end
