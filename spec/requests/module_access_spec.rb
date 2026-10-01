require "rails_helper"

RSpec.describe "Dostęp do modułów według licencji", type: :request do
  it "przekierowuje niezalogowanych do logowania" do
    get "/live"

    expect(response).to redirect_to(new_session_path)
  end

  context "konto z samym Chatem" do
    let(:user) { create(:user, modules: [ :chat ]) }

    before { sign_in(user) }

    it "otwiera Chat" do
      get "/chat"

      expect(response).to have_http_status(:ok)
      expect_inertia.to render_component("chat/index")
    end

    it "pokazuje ofertę zamiast modułu Live" do
      get "/live"

      expect(response).to have_http_status(:forbidden)
      expect_inertia.to render_component("core/module_locked")
      expect_inertia.to have_props(module: "live")
    end

    it "nie daje panelu zamówień" do
      get "/orders"

      expect(response).to have_http_status(:forbidden)
      expect_inertia.to have_props(module: "orders")
    end

    it "udostępnia moduły we wspólnych propsach" do
      get "/"

      expect_inertia.to render_component("core/dashboard")
      expect_inertia.to have_props(modules: { enabled: [ "chat" ], ordersPanel: false, bundle: nil })
    end
  end

  context "konto z pakietem ONE" do
    let(:user) { create(:user, modules: Licensing::MODULES) }

    before { sign_in(user) }

    it "otwiera wszystkie moduły i panel zamówień" do
      %w[/live /multichannel /chat /orders].each do |path|
        get path
        expect(response).to have_http_status(:ok), "#{path} zwróciło #{response.status}"
      end
    end
  end
end
