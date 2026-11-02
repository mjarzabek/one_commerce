require "rails_helper"

RSpec.describe "REST API v1", type: :request do
  let(:account) { create(:account) }
  let(:headers) { { "Authorization" => "Bearer #{raw_token}" } }
  let(:raw_token) { Accounts.issue_api_token!(account:, name: "Test", scopes: %w[orders:read]).last }

  it "odrzuca żądanie bez tokenu" do
    get "/api/v1/account"

    expect(response).to have_http_status(:unauthorized)
  end

  it "zwraca konto i jego moduły" do
    Licensing.grant!(account, :chat)

    get "/api/v1/account", headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig("data", "modules", "enabled")).to eq([ "chat" ])
  end

  it "blokuje zamówienia bez Live lub MultiChannel" do
    Licensing.grant!(account, :chat)

    get "/api/v1/orders", headers: headers

    expect(response).to have_http_status(:payment_required)
  end

  it "zwraca pustą listę zamówień przy module Live" do
    Licensing.grant!(account, :live)

    get "/api/v1/orders", headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq("data" => [], "meta" => { "next_cursor" => nil })
  end

  context "z danymi" do
    let(:raw_token) do
      Accounts.issue_api_token!(account:, name: "Test", scopes: %w[orders:read catalog:read inventory:read customers:read]).last
    end
    let(:variant) { create(:variant, parent: create(:main_product, account:), sku: "SUK-M", price_cents: 15_000, stock: 4) }
    let!(:order) do
      Orders.create_from(account:, source: :live, items: [ { product_id: variant.id, quantity: 1 } ],
        customer: { channel: "facebook", external_id: "fb-1", name: "Anna" })
    end

    before { Licensing.grant!(account, :live) }

    it "zwraca zamówienia z pozycjami i klientem" do
      get "/api/v1/orders", headers: headers

      data = response.parsed_body["data"].sole
      expect(data).to include("number" => order.number, "status" => "new", "total_cents" => 15_000)
      expect(data["customer"]).to include("name" => "Anna")
      expect(data["items"].sole).to include("sku" => "SUK-M", "quantity" => 1)
    end

    it "zwraca jedno zamówienie z historią statusów" do
      get "/api/v1/orders/#{order.id}", headers: headers

      expect(response.parsed_body.dig("data", "status_changes").sole).to include("to_status" => "new")
    end

    it "zwraca produkty z dostępnością" do
      get "/api/v1/products", headers: headers

      expect(response.parsed_body["data"].sole["variants"].sole).to include("sku" => "SUK-M", "available" => 3)
    end

    it "zwraca stany magazynowe" do
      get "/api/v1/stock", headers: headers

      expect(response.parsed_body["data"].sole).to include("sku" => "SUK-M", "on_hand" => 4, "reserved" => 1, "available" => 3)
    end

    it "zwraca klientów z tożsamościami" do
      get "/api/v1/customers", headers: headers

      expect(response.parsed_body["data"].sole["identities"].sole).to include("channel" => "facebook", "external_id" => "fb-1")
    end

    it "nie pokazuje danych innego konta" do
      other = create(:account)
      Licensing.grant!(other, :live)
      _token, raw = Accounts.issue_api_token!(account: other, name: "Obce", scopes: %w[*])
      foreign = { "Authorization" => "Bearer #{raw}" }

      get "/api/v1/orders", headers: foreign
      expect(response.parsed_body["data"]).to be_empty

      get "/api/v1/orders/#{order.id}", headers: foreign
      expect(response).to have_http_status(:not_found)

      get "/api/v1/products", headers: foreign
      expect(response.parsed_body["data"]).to be_empty
    end

    it "wymaga zakresu catalog:read dla produktów" do
      _token, raw = Accounts.issue_api_token!(account:, name: "Tylko zamówienia", scopes: %w[orders:read])

      get "/api/v1/products", headers: { "Authorization" => "Bearer #{raw}" }

      expect(response).to have_http_status(:forbidden)
    end
  end

  it "wymaga zakresu orders:read" do
    Licensing.grant!(account, :live)
    _token, raw = Accounts.issue_api_token!(account:, name: "Bez zakresów", scopes: [])

    get "/api/v1/orders", headers: { "Authorization" => "Bearer #{raw}" }

    expect(response).to have_http_status(:forbidden)
  end
end
