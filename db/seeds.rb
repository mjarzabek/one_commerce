# Dane demonstracyjne: `bin/rails db:seed`
#
# Trzy konta pokazują różne pakiety:
#   one@example.com          - pakiet ONE (wszystkie moduły)
#   live@example.com         - tylko Live (z panelem zamówień)
#   chat@example.com         - tylko Chat (bez panelu zamówień)
# Hasło dla wszystkich: password123
#
# Konta ONE i Live dostają katalog z wariantami, stany magazynowe i 40 zamówień w różnych statusach.

Inventory.ensure_product_id_start!

def demo_account(email, account_name:, user_name:)
  existing = User.find_by(email_address: email)
  return Accounts.default_account_for(existing) if existing

  Accounts.create_with_owner!(account_name:, user_name:, email_address: email, password: "password123")
end

one = demo_account("one@example.com", account_name: "Butik Demo ONE", user_name: "Anna Nowak")
Licensing.grant_bundle!(one, :one)

live = demo_account("live@example.com", account_name: "Butik Live", user_name: "Kasia Live")
Licensing.grant!(live, :live, trial_days: Licensing::TRIAL_DAYS)

chat = demo_account("chat@example.com", account_name: "Sklep Chat", user_name: "Marek Chat")
Licensing.grant!(chat, :chat)

# Magazyn: dwa magazyny w domyślnym katalogu, dwie grupy cenowe, produkty proste i wariantowe ze stanami.
# Zwraca produkty sprzedawalne (proste i warianty).
def demo_inventory(account)
  Inventory.ensure_setup!(account)
  catalog = Inventory.default_catalog(account)
  unless Inventory.products(account).exists?
    retail = Inventory.default_price_group(account)
    allegro = Inventory.price_groups(account).create!(name: "Allegro", currency: "PLN", position: 1)
    catalog.update!(price_group_ids: catalog.price_group_ids + [ allegro.id ])
    shop = Inventory.warehouses(account).create!(name: "Sklep stacjonarny", position: 1)
    catalog.update!(warehouse_ids: catalog.warehouse_ids + [ shop.id ])
    price = ->(cents) { { retail.id => cents, allegro.id => (cents * 1.1).round(-2) - 1 } }

    Inventory.create_product!(account, { name: "Sukienka Lena", sku: "LENA", ean: "5901234560018" }, catalog:, variants: [
      { name: "S", sku: "LENA-S", ean: "5901234560025", prices: price.(19_900) },
      { name: "M", sku: "LENA-M", ean: "5901234560032", prices: price.(19_900) },
      { name: "L", sku: "LENA-L", ean: "5901234560049", prices: price.(19_900) }
    ])
    Inventory.create_product!(account, { name: "Sweter Mira", sku: "MIRA" }, catalog:, variants: [
      { name: "beżowy", sku: "MIRA-BEZ", prices: price.(14_900) },
      { name: "czarny", sku: "MIRA-CZA", prices: price.(14_900) }
    ])
    Inventory.create_product!(account, { name: "Apaszka jedwabna", sku: "APASZKA", ean: "5901234560056", prices: price.(5_900) }, catalog:)

    Inventory.find_products(account, catalog:).each do |product|
      Inventory.receive!(account, product.id, 8, reference: "Stan początkowy")
      Inventory.receive!(account, product.id, 3, warehouse_id: shop.id, reference: "Stan początkowy")
    end
  end
  Inventory.find_products(account, catalog:)
end

# Zamówienia demo: Live (z katalogu, z rezerwacjami), marketplace'y i sklep (pozycje spoza katalogu) oraz ręczne -
# w różnych statusach, z różnymi płatnościami (także za pobraniem) i adresami, rozłożone na ostatni miesiąc.
DEMO_BUYERS = [
  { channel: "facebook", external_id: "fb-1001", handle: "Anna Kowalska", name: "Anna Kowalska", phone: "+48 600 100 200" },
  { channel: "instagram", external_id: "ig-2002", handle: "@ola.moda", name: "Aleksandra Wiśniewska" },
  { channel: "email", external_id: "jan@example.com", name: "Jan Zieliński", email: "jan@example.com", phone: "+48 501 222 333" },
  { channel: "allegro", external_id: "al-3003", handle: "marta_k", name: "Marta Kamińska", email: "marta.k@example.com" },
  { channel: "shop", external_id: "shop-4004", name: "Piotr Lewandowski", email: "piotr@example.com", phone: "+48 512 444 555" },
  { channel: "allegro", external_id: "al-5005", handle: "ewa.dab", name: "Ewa Dąbrowska", email: "ewa.d@example.com" },
  { channel: "facebook", external_id: "fb-6006", handle: "Karolina Wójcik", name: "Karolina Wójcik" },
  { channel: "shop", external_id: "shop-7007", name: "Tomasz Mazur", email: "tomasz.mazur@example.com", phone: "+48 698 777 888" }
].freeze
DEMO_STREETS = [ [ "Marszałkowska 12/4", "00-590", "Warszawa" ], [ "Piotrkowska 101", "90-425", "Łódź" ],
                 [ "Długa 7", "80-827", "Gdańsk" ], [ "Floriańska 33/2", "31-019", "Kraków" ],
                 [ "Świdnicka 18", "50-068", "Wrocław" ], [ "Półwiejska 5/10", "61-885", "Poznań" ] ].freeze
DEMO_OFFERS = [ [ "ALG-SUK-01", "Sukienka midi w kwiaty", 17_900 ], [ "ALG-KOS-02", "Koszula lniana oversize", 12_900 ],
                [ "ALG-SPO-03", "Spodnie szerokie z wiskozy", 15_900 ], [ "SHP-TOR-04", "Torebka skórzana", 24_900 ],
                [ "SHP-PAS-05", "Pasek z klamrą", 6_900 ], [ "SHP-KOL-06", "Kolczyki pozłacane", 4_900 ] ].freeze
DEMO_SHIPPING = [ [ "InPost Paczkomat", 1_499 ], [ "Kurier DPD", 1_899 ], [ "Kurier DPD - pobranie", 2_499 ], [ "Odbiór osobisty", 0 ] ].freeze

DEMO_LOCKERS = [ [ "WAW217AP", "Marszałkowska 104", "00-017", "Warszawa" ], [ "LOD05M", "Piotrkowska 200", "90-368", "Łódź" ],
                 [ "GDA121M", "Grunwaldzka 82", "80-244", "Gdańsk" ], [ "KRA01N", "Karmelicka 9", "31-133", "Kraków" ] ].freeze
DEMO_COMPANIES = [ [ "Studio Kamińska sp. z o.o.", "5252812345" ], [ "Lewandowski Design", "7792345678" ] ].freeze

# Pola dodatkowe demo: priorytet (lista), prezent (tak/nie), termin wysyłki (data).
def demo_custom_fields(account)
  return Orders.custom_fields(account).to_a if Orders.custom_fields(account).exists?

  [ { name: "Priorytet", kind: "select", options: %w[Normalny Pilny] }, { name: "Pakowanie na prezent", kind: "boolean" },
    { name: "Termin wysyłki", kind: "date" } ].map { Orders.custom_fields(account).create!(account:, **_1) }
end

def demo_orders(account, products, source:)
  Orders.ensure_setup!(account)
  priority, gift, deadline = demo_custom_fields(account)

  rng = Random.new(account.id)
  statuses = Orders.statuses(account).index_by(&:name)
  # Rozkład statusów: większość do realizacji i wysłanych, kilka anulowanych i zwróconych.
  status_pool = %w[Nowe Nowe Nowe Nowe Potwierdzone Potwierdzone W\ realizacji W\ realizacji W\ realizacji Wysłane Wysłane Wysłane
                   Dostarczone Dostarczone Dostarczone Dostarczone Anulowane Zwrócone]
  sellable = products.select { _1.price_cents }

  40.times do |index|
    buyer = DEMO_BUYERS[rng.rand(DEMO_BUYERS.size)]
    street, postal_code, city = DEMO_STREETS[rng.rand(DEMO_STREETS.size)]
    method, price_cents = DEMO_SHIPPING[rng.rand(DEMO_SHIPPING.size)]
    cod = method.include?("pobranie")
    locker = DEMO_LOCKERS[rng.rand(DEMO_LOCKERS.size)] if method.include?("Paczkomat")
    company = DEMO_COMPANIES[rng.rand(DEMO_COMPANIES.size)] if index % 5 == 0
    order_source = index < 12 ? source : (index < 34 ? :multichannel : :manual)
    items =
      if order_source == source
        sellable.sample(rng.rand(1..2), random: rng).map { { product_id: _1.id, quantity: 1 } }
      else
        DEMO_OFFERS.sample(rng.rand(1..3), random: rng).map { |sku, name, cents| { sku:, name:, quantity: rng.rand(1..2), unit_price_cents: cents } }
      end
    status = status_pool[rng.rand(status_pool.size)]
    paid = !cod && (status != "Nowe" || rng.rand < 0.4)

    order = Orders.create_from(account:, source: order_source, external_id: "demo-#{index + 1}", customer: buyer, items:,
      source_channel: { multichannel: buyer[:channel] == "allegro" ? "Allegro" : "Sklep WWW" }[order_source],
      shipping: { method:, price_cents: },
      shipping_address: { name: buyer[:name], street:, postal_code:, city:, country: "PL", phone: buyer[:phone] }.compact,
      pickup_point: locker ? { name: "Paczkomat #{locker[0]}", code: locker[0], street: locker[1], postal_code: locker[2], city: locker[3] } : {},
      billing_address: company ? { name: buyer[:name], company: company[0], nip: company[1], street:, postal_code:, city:, country: "PL" } : {},
      wants_invoice: company.present?,
      payment_method: cod ? :cod : (order_source == :manual ? :transfer : :online),
      payment_status: paid || (cod && status == "Dostarczone") ? :paid : :unpaid,
      notes: index % 9 == 0 ? "Klientka prosi o dołączenie paragonu." : nil,
      customer_message: index % 4 == 1 ? "Proszę o wysyłkę jeszcze w tym tygodniu, to prezent. Dziękuję!" : nil,
      placed_at: (40 - index).times.sum { rng.rand(10..20) }.hours.ago)
    next unless order.previously_new_record?

    Orders.change_status!(order, statuses.fetch(status)) unless status == "Nowe"
    # Kilka wpłat częściowych (przelew na część kwoty) i nadpłat, żeby było widać wszystkie stany płatności.
    if !cod && index % 8 == 3
      Orders.update_payment!(order, paid_cents: order.total_cents / 2)
    elsif !cod && index % 13 == 5
      Orders.update_payment!(order, paid_cents: order.total_cents + 1_000)
    end
    Orders.update_custom_fields!(order, { priority.id => index % 4 == 0 ? "Pilny" : "Normalny", gift.id => index % 7 == 0,
                                          deadline.id => (order.placed_at + 2.days).to_date.iso8601 })
  rescue Inventory::InsufficientStock
    next
  end
end

[ [ one, :live ], [ live, :live ] ].each do |account, source|
  demo_orders(account, demo_inventory(account), source:)
end

unless one.api_tokens.exists?
  _token, raw = Accounts.issue_api_token!(account: one, name: "Demo",
    scopes: %w[orders:read catalog:read inventory:read customers:read])
  puts "Token API dla one@example.com: #{raw}"
end

puts "Konta demo gotowe. Hasło: password123"
