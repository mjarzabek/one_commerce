# Dane demonstracyjne: `bin/rails db:seed`
#
# Trzy konta pokazują różne pakiety:
#   one@example.com          - pakiet ONE (wszystkie moduły)
#   live@example.com         - tylko Live (z panelem zamówień)
#   chat@example.com         - tylko Chat (bez panelu zamówień)
# Hasło dla wszystkich: password123
#
# Konta ONE i Live dostają katalog z wariantami, stany magazynowe i kilka zamówień.

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

def demo_orders(account, products, source:)
  by_sku = products.index_by(&:sku)
  buyers = [
    { channel: "facebook", external_id: "fb-1001", handle: "Anna Kowalska", name: "Anna Kowalska" },
    { channel: "instagram", external_id: "ig-2002", handle: "@ola.moda", name: "Aleksandra Wiśniewska" },
    { channel: "email", external_id: "jan@example.com", name: "Jan Zieliński", email: "jan@example.com" }
  ]
  [
    [ "demo-1", buyers[0], [ [ "LENA-M", 1 ], [ "APASZKA", 2 ] ], %i[paid] ],
    [ "demo-2", buyers[1], [ [ "MIRA-CZA", 1 ] ], %i[paid processing shipped] ],
    [ "demo-3", buyers[2], [ [ "LENA-S", 1 ], [ "MIRA-BEZ", 1 ] ], [] ],
    [ "demo-4", buyers[0], [ [ "APASZKA", 1 ] ], %i[cancelled] ]
  ].each do |external_id, customer, lines, statuses|
    order = Orders.create_from(account:, source:, external_id:, customer:,
      items: lines.map { |sku, quantity| { product_id: by_sku.fetch(sku).id, quantity: } },
      shipping: { method: "InPost Paczkomat", price_cents: 1_499 })
    next unless order.previously_new_record?

    statuses.each { Orders.transition!(order, to: _1) }
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
