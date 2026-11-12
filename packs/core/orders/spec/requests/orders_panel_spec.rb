require "rails_helper"

RSpec.describe "Panel zamówień", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }

  before { sign_in(user) }

  def create_order(name: "Jan Nowak", cents: 123_450, **options)
    Orders.create_from(account:, source: :manual, customer: { name:, email: "#{name.parameterize}@example.com" },
      items: [ { name: "Usługa", quantity: 1, unit_price_cents: cents } ], **options)
  end

  def status(name) = Orders.statuses(account).find_by!(name:)

  # Zamówienia i stronicowanie dochodzą osobnym zapytaniem (deferred).
  def get_list(params = {})
    get("/orders", params:)
    inertia_load_deferred_props(:list)
  end

  def rows = inertia.props[:orders]

  describe "lista" do
    it "pokazuje zamówienia z etykietami, płatnością i statusem" do
      create_order(payment_method: :cod)

      get_list

      expect_inertia.to render_component("core/orders/index")
      expect(rows.sole).to include("source" => "Ręczne", "total" => "1 234,50 PLN")
      expect(rows.sole["customer"]).to include("name" => "Jan Nowak")
      expect(rows.sole["status"]).to include("name" => "Nowe", "color" => "blue")
      expect(rows.sole["payment"]).to include("status" => "unpaid", "method" => "cod")
    end

    it "liczy zamówienia w statusach i filtruje po statusie oraz grupie" do
      first = create_order(name: "Anna")
      create_order(name: "Basia")
      Orders.change_status!(first, status("Wysłane"))

      get "/orders", params: { status: status("Wysłane").id }
      counts = inertia.props[:statusTree][:groups].flat_map { _1[:statuses] }.to_h { [ _1[:name], _1[:count] ] }
      expect(counts).to include("Nowe" => 1, "Wysłane" => 1, "Dostarczone" => 0)
      expect(inertia.props[:totalCount]).to eq(2)
      expect(inertia.props[:view]).to include("status" => status("Wysłane").id, "group" => nil)

      inertia_load_deferred_props(:list)
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Anna" ])

      group = Orders.status_groups(account).find_by!(name: "Do realizacji")
      get_list(group: group.id)
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Basia" ])
    end

    it "wyszukuje po kliencie i filtruje pobranie" do
      create_order(name: "Anna", payment_method: :cod)
      create_order(name: "Basia")

      get_list(q: "basia")
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Basia" ])

      get_list(payment: "cod")
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Anna" ])

      get_list(payment: "unpaid")
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Basia" ])

      create_order(name: "Celina", paid_cents: 100)
      get_list(payment: "partial")
      expect(rows.map { _1.dig("customer", "name") }).to eq([ "Celina" ])
    end

    it "sortuje po wartości" do
      create_order(name: "Tanie", cents: 100)
      create_order(name: "Drogie", cents: 10_000)

      get_list(sort: "total", dir: "asc")

      expect(rows.map { _1.dig("customer", "name") }).to eq(%w[Tanie Drogie])
    end

    it "zmienia status zaznaczonych i wszystkich pasujących" do
      orders = Array.new(3) { create_order(name: "Klient #{_1}") }

      post "/orders/bulk", params: { operation: "status", status_id: status("W realizacji").id, ids: orders.first(2).map(&:id) }
      expect(flash[:notice]).to eq("Zmieniono status 2 zamówień na „W realizacji”.")

      post "/orders/bulk", params: { operation: "status", status_id: status("Wysłane").id, all: "true", status: status("Nowe").id }
      expect(orders.map { _1.reload.status.name }).to eq([ "W realizacji", "W realizacji", "Wysłane" ])
    end
  end

  describe "karta zamówienia" do
    let(:order) { create_order(shipping_address: { name: "Jan Nowak", street: "Długa 1", postal_code: "00-001", city: "Warszawa" }) }

    it "pokazuje pozycje, sumy, adres i historię" do
      get "/orders/#{order.id}"

      expect_inertia.to render_component("core/orders/show")
      data = inertia.props[:order]
      expect(data[:items].sole).to include("name" => "Usługa", "quantity" => 1, "total" => "1 234,50 PLN", "href" => nil)
      expect(data[:totals]).to include("total" => "1 234,50 PLN")
      expect(data.dig(:addresses, :shipping)).to include("city" => "Warszawa")
      expect(data[:history].sole).to include("from" => nil, "to" => { "name" => "Nowe", "color" => "blue" })
      expect(data[:totals]).to include("quantity" => 1)
      expect(inertia.props[:navigation]).to include("list" => "/orders", "previous" => nil, "next" => nil)
    end

    it "prowadzi do poprzedniego i następnego zamówienia na liście, z której przyszliśmy" do
      older = create_order(name: "Starsze", placed_at: 2.days.ago)
      newer = create_order(name: "Nowsze", placed_at: 1.hour.ago)
      shipped = create_order(name: "Wysłane", placed_at: 1.day.ago).tap { Orders.change_status!(_1, status("Wysłane")) }
      middle = create_order(name: "Środkowe", placed_at: 1.day.ago - 1.hour)
      new_status = status("Nowe").id

      get "/orders/#{middle.id}", params: { status: new_status }

      expect(inertia.props[:navigation]).to eq(
        "list" => "/orders?status=#{new_status}",
        "previous" => "/orders/#{newer.id}?status=#{new_status}",
        "next" => "/orders/#{older.id}?status=#{new_status}"
      )
      expect(shipped.status.name).to eq("Wysłane")
    end

    it "zmienia status z wpisem w historii" do
      patch "/orders/#{order.id}/status", params: { status_id: status("Wysłane").id }

      expect(response).to redirect_to("/orders/#{order.id}")
      expect(order.reload.status.name).to eq("Wysłane")
      expect(order.status_changes.last).to have_attributes(from_status: "Nowe", to_status: "Wysłane", user_id: user.id)
    end

    it "zapisuje wpłatę, metodę płatności i notatkę" do
      patch "/orders/#{order.id}/payment", params: { paid: "1 000,50", payment_method: "transfer" }
      patch "/orders/#{order.id}", params: { notes: "  Zadzwonić przed wysyłką " }

      expect(order.reload).to have_attributes(paid_cents: 100_050, payment_status: "partial", payment_method: "transfer",
        notes: "Zadzwonić przed wysyłką")

      get "/orders/#{order.id}"
      expect(inertia.props.dig(:order, :payment)).to include("status" => "partial", "paid" => "1 000,50 PLN",
        "total" => "1 234,50 PLN", "remaining" => "234,00 PLN", "paidInput" => "1000,50")
    end

    it "zmienia sposób i koszt dostawy, przeliczając wartość i status płatności" do
      Orders.update_payment!(order, paid_cents: order.total_cents)
      patch "/orders/#{order.id}/shipping", params: { method: " Kurier DPD ", price: "20,00" }

      expect(order.reload).to have_attributes(shipping_method: "Kurier DPD", shipping_cents: 2_000, total_cents: 125_450,
        payment_status: "partial")

      patch "/orders/#{order.id}/shipping", params: { method: "", price: "abc" }
      follow_redirect!
      expect(inertia.props[:errors]["price"]).to be_present
      expect(inertia.props[:shippingMethods]).to eq([ "Kurier DPD" ])
    end

    it "dodaje, zmienia i usuwa pozycje spoza katalogu" do
      post "/orders/#{order.id}/items", params: { name: "Grawer", sku: "", quantity: "2", unit_price: "10,00", tax_rate: "8" }
      item = order.items.reload.find_by!(name: "Grawer")
      expect(item).to have_attributes(quantity: 2, unit_price_cents: 1_000, tax_rate: 8, sku: nil)

      patch "/orders/#{order.id}/items/#{item.id}", params: { quantity: "3", unit_price: "12,50" }
      expect(item.reload).to have_attributes(quantity: 3, unit_price_cents: 1_250)
      expect(order.reload.total_cents).to eq(123_450 + 3_750)

      delete "/orders/#{order.id}/items/#{item.id}"
      expect(order.items.reload.size).to eq(1)
    end

    it "zwraca błędy pozycji i szuka produktów do dodania" do
      post "/orders/#{order.id}/items", params: { name: "", quantity: "0", unit_price: "abc" }
      follow_redirect!
      expect(inertia.props[:errors].keys).to include("name", "quantity", "unit_price")

      product = create(:product, account:, name: "Torebka skórzana", sku: "TOR-1", price_cents: 25_000, stock: 4)
      get "/orders/#{order.id}/items/products", params: { q: "torebka" }, as: :json
      expect(response.parsed_body).to contain_exactly(include("id" => product.id, "price" => "250,00 PLN", "available" => 4))
    end

    it "odrzuca nieprawidłową kwotę wpłaty" do
      patch "/orders/#{order.id}/payment", params: { paid: "dużo" }
      follow_redirect!

      expect(inertia.props[:errors]["paid"]).to be_present
      expect(order.reload.paid_cents).to eq(0)
    end

    it "edytuje adres dostawy, dane do faktury z NIP-em i punkt odbioru" do
      patch "/orders/#{order.id}/address", params: { kind: "billing", wants_invoice: "true",
        address: { company: " Studio sp. z o.o. ", nip: "525-281-23-45", city: "Kraków", phone: "pominięte" } }
      patch "/orders/#{order.id}/address", params: { kind: "pickup", address: { name: "Paczkomat WAW217AP", code: "WAW217AP" } }

      expect(order.reload).to have_attributes(wants_invoice: true,
        billing_address: { "company" => "Studio sp. z o.o.", "nip" => "5252812345", "city" => "Kraków" },
        pickup_point: { "name" => "Paczkomat WAW217AP", "code" => "WAW217AP" })
    end

    it "odrzuca nieprawidłowy NIP i e-mail klienta" do
      patch "/orders/#{order.id}/address", params: { kind: "billing", address: { nip: "123" } }
      follow_redirect!
      expect(inertia.props[:errors]["nip"]).to be_present

      patch "/orders/#{order.id}/customer", params: { name: "Jan", email: "zły", phone: "" }
      follow_redirect!
      expect(inertia.props[:errors]["email"]).to be_present
      expect(order.reload.customer_email).to eq("jan-nowak@example.com")
    end

    it "zapisuje dane klienta" do
      patch "/orders/#{order.id}/customer", params: { name: "Jan Kowalski", email: "jan@example.com", phone: "+48 600 100 200" }

      expect(order.reload).to have_attributes(customer_name: "Jan Kowalski", customer_email: "jan@example.com", customer_phone: "+48 600 100 200")
    end

    it "zapisuje pola dodatkowe z walidacją typu" do
      priority = Orders.custom_fields(account).create!(account:, name: "Priorytet", kind: "select", options: %w[Normalny Pilny])
      weight = Orders.custom_fields(account).create!(account:, name: "Waga", kind: "number")
      gift = Orders.custom_fields(account).create!(account:, name: "Prezent", kind: "boolean")

      patch "/orders/#{order.id}/fields", params: { values: { priority.id => "Pilny", weight.id => "1,5", gift.id => "true" } }
      expect(order.reload.custom_fields).to eq(priority.id.to_s => "Pilny", weight.id.to_s => "1.5", gift.id.to_s => true)

      patch "/orders/#{order.id}/fields", params: { values: { priority.id => "Inny", weight.id => "" } }
      follow_redirect!
      expect(inertia.props[:errors]["values.#{priority.id}"]).to be_present
      expect(order.reload.custom_fields[weight.id.to_s]).to eq("1.5")

      get "/orders/#{order.id}"
      expect(inertia.props[:customFields].map { _1[:name] }).to eq(%w[Priorytet Waga Prezent])
    end

    it "nie pokazuje zamówienia innego konta" do
      other = Orders.create_from(account: create(:account), source: :manual, items: [ { name: "X", quantity: 1, unit_price_cents: 1 } ])

      get "/orders/#{other.id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "ustawienia pól dodatkowych" do
    it "dodaje pole listy, nie zmienia typu i usuwa pole razem z wartościami" do
      post "/orders/settings/fields", params: { name: "Priorytet", kind: "select", options: "Normalny\nPilny\n\nPilny" }
      field = Orders.custom_fields(account).sole
      expect(field).to have_attributes(kind: "select", options: %w[Normalny Pilny])

      patch "/orders/settings/fields/#{field.id}", params: { name: "Ważność", kind: "text", options: "Niska\nWysoka" }
      expect(field.reload).to have_attributes(name: "Ważność", kind: "select", options: %w[Niska Wysoka])

      order = create_order
      Orders.update_custom_fields!(order, { field.id => "Niska" })
      get "/orders/settings/fields"
      expect(inertia.props[:fields].sole).to include("orders" => 1)

      delete "/orders/settings/fields/#{field.id}"
      expect(order.reload.custom_fields).to eq({})
    end

    it "zapisuje kolejność po przeciągnięciu" do
      first, second = %w[A B].map { Orders.custom_fields(account).create!(account:, name: _1, kind: "text") }

      patch "/orders/settings/fields/reorder", as: :json, params: { ids: [ second.id, first.id ] }

      expect(Orders.custom_fields(account).map(&:name)).to eq(%w[B A])
    end

    it "wymaga wartości dla listy" do
      post "/orders/settings/fields", params: { name: "Priorytet", kind: "select", options: "" }
      follow_redirect!

      expect(inertia.props[:errors]["options"]).to be_present
    end
  end

  describe "ustawienia statusów" do
    it "pokazuje statusy w grupach z licznikami" do
      create_order

      get "/orders/settings/statuses"

      expect_inertia.to render_component("core/orders/settings/statuses")
      expect(inertia.props[:tree][:groups].map { _1[:name] }).to eq([ "Do realizacji", "Zakończone" ])
      expect(inertia.props[:tree][:groups].first[:statuses].first).to include("name" => "Nowe", "default" => true, "count" => 1)
    end

    it "dodaje grupę i status, zmienia kolejność i domyślny" do
      post "/orders/settings/groups", params: { name: "Problemy" }
      group = Orders.status_groups(account).find_by!(name: "Problemy")
      post "/orders/settings/statuses", params: { name: "Brak towaru", color: "orange", group_id: group.id }
      post "/orders/settings/statuses", params: { name: "Reklamacja", color: "red", group_id: group.id }
      created = status("Reklamacja")

      patch "/orders/settings/statuses/reorder", as: :json, params: {
        groups: [ group.id ], sections: [ { group_id: group.id, statuses: [ created.id, status("Brak towaru").id ] } ]
      }
      patch "/orders/settings/statuses/#{created.id}/default"

      expect(group.statuses.reload.map(&:name)).to eq([ "Reklamacja", "Brak towaru" ])
      expect(Orders.default_status(account)).to eq(created)
      expect(create_order.status).to eq(created)
    end

    it "zapisuje kolejność po przeciągnięciu: grupy, statusy i przeniesienie do innej grupy" do
      todo, done = Orders.status_groups(account).ordered.to_a
      patch "/orders/settings/statuses/reorder", as: :json, params: {
        groups: [ done.id, todo.id ],
        sections: [
          { group_id: nil, statuses: [ status("Wysłane").id ] },
          { group_id: done.id, statuses: [ status("Dostarczone").id, status("Nowe").id ] },
          { group_id: todo.id, statuses: (todo.statuses.map(&:id) - [ status("Nowe").id ]) }
        ]
      }

      expect(response).to redirect_to("/orders/settings/statuses")
      expect(Orders.status_groups(account).ordered.map(&:name)).to eq([ "Zakończone", "Do realizacji" ])
      expect(status("Wysłane").group_id).to be_nil
      expect(done.statuses.reload.map(&:name)).to eq([ "Dostarczone", "Nowe" ])
    end

    it "pomija w kolejności statusy i grupy innego konta" do
      other_account = create(:account).tap { Orders.ensure_setup!(_1) }
      other = Orders.statuses(other_account).find_by!(name: "Nowe")
      patch "/orders/settings/statuses/reorder", as: :json, params: { sections: [ { group_id: nil, statuses: [ other.id ] } ] }

      expect(other.reload.group_id).to be_present
    end

    it "odrzuca powtórzoną nazwę" do
      post "/orders/settings/statuses", params: { name: "Nowe", color: "blue" }

      follow_redirect!

      expect(inertia.props[:errors]["name"]).to be_present
      expect(Orders.statuses(account).where(name: "Nowe").count).to eq(1)
    end

    it "nie usuwa statusu z zamówieniami, a usunięcie grupy zostawia statusy" do
      create_order
      delete "/orders/settings/statuses/#{status("Nowe").id}"
      expect(flash[:alert]).to be_present

      group = Orders.status_groups(account).find_by!(name: "Zakończone")
      delete "/orders/settings/groups/#{group.id}"

      expect(status("Wysłane").group_id).to be_nil
    end
  end
end
