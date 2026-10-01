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

  it "zwraca listę zamówień przy module Live" do
    Licensing.grant!(account, :live)

    get "/api/v1/orders", headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq("data" => [], "meta" => { "next_cursor" => nil })
  end

  it "wymaga zakresu orders:read" do
    Licensing.grant!(account, :live)
    _token, raw = Accounts.issue_api_token!(account:, name: "Bez zakresów", scopes: [])

    get "/api/v1/orders", headers: { "Authorization" => "Bearer #{raw}" }

    expect(response).to have_http_status(:forbidden)
  end
end
