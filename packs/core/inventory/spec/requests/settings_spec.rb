require "rails_helper"

RSpec.describe "Magazyn – katalogi, magazyny i ceny", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }
  let(:catalog) { Inventory.default_catalog(account) }
  let(:main) { Inventory.warehouses(account).first }
  let(:retail) { Inventory.default_price_group(account) }

  before do
    sign_in(user)
    Inventory.ensure_setup!(account)
  end

  it "otwiera zakładki Katalogi, Magazyny i Ceny" do
    create(:variant, parent: create(:main_product, account:))
    create(:product, account:)

    get "/inventory/catalogs"
    expect_inertia.to render_component("core/inventory/catalogs/index")
    expect(inertia.props[:catalogs].sole).to include("products" => 2, "warehouse_ids" => [ main.id ])

    get "/inventory/warehouses"
    expect_inertia.to render_component("core/inventory/warehouses/index")
    expect(inertia.props[:warehouses].sole).to include("name" => "Magazyn główny", "units" => 0)
    expect(inertia.props[:warehouses].sole["catalogs"].map { _1["name"] }).to eq([ "Domyślny" ])

    get "/inventory/prices"
    expect_inertia.to render_component("core/inventory/prices/index")
    expect(inertia.props[:sellable]).to eq(2)
  end

  describe "magazyny" do
    it "tworzy magazyn niezależnie od katalogu" do
      catalog
      post "/inventory/warehouses", params: { name: "Punkt Y" }

      expect(Inventory.warehouses(account).map(&:name)).to eq([ "Magazyn główny", "Punkt Y" ])
      expect(Inventory.warehouses(account, catalog:).map(&:name)).to eq([ "Magazyn główny" ])
    end

    it "nie usuwa magazynu z towarem ani jedynego magazynu katalogu, a pusty usuwa" do
      create(:product, account:, stock: 1)
      spare = Inventory::Warehouse.create!(account:, name: "Pusty")

      delete "/inventory/warehouses/#{main.id}"
      delete "/inventory/warehouses/#{spare.id}"

      expect(Inventory.warehouses(account).map(&:name)).to eq([ "Magazyn główny" ])
    end

    it "nie pozwala zejść poniżej zarezerwowanych sztuk" do
      product = create(:product, account:, stock: 5)
      Inventory.reserve!(account, product.id, 4, holder: create(:customer, account:), warehouse_id: main.id)

      post "/inventory/products/#{product.id}/adjustments", params: { mode: "set", warehouse_id: main.id, quantity: "1" },
        headers: { "HTTP_REFERER" => "/inventory/products/#{product.id}/edit" }

      follow_redirect!
      expect(inertia.props[:errors]["quantity"].first).to include("zarezerwowanych")
    end

    it "zwalnia i realizuje rezerwację z karty produktu" do
      product = create(:product, account:, stock: 5)
      released = Inventory.reserve!(account, product.id, 2, holder: create(:customer, account:), warehouse_id: main.id)
      fulfilled = Inventory.reserve!(account, product.id, 1, holder: create(:customer, account:), warehouse_id: main.id)

      post "/inventory/reservations/#{released.id}/release"
      post "/inventory/reservations/#{fulfilled.id}/fulfill"

      get "/inventory/products/#{product.id}/edit"
      stock = inertia.props[:stock]
      expect(stock["warehouses"].sole).to include("on_hand" => 4, "reserved" => 0)
      expect(stock["reservations"]).to be_empty
      expect(stock["movements"].first).to include("reason" => "Sprzedaż", "before" => 5, "quantity" => -1, "after" => 4, "user" => user.name)
    end

    it "ustawia magazyn i rezerwację dla źródła zamówień" do
      shop = Inventory::Warehouse.create!(account:, name: "Punkt Y")

      patch "/inventory/sources", params: { source: "ecommerce", enabled: false }
      patch "/inventory/sources", params: { source: "ecommerce", warehouse_id: shop.id }

      expect(Inventory.source_settings(account)["ecommerce"]).to eq(enabled: false, warehouse_id: shop.id)
      get "/inventory/warehouses"
      expect(inertia.props[:sources]["ecommerce"]).to eq("enabled" => false, "warehouse_id" => shop.id)
    end

    it "nie usuwa magazynu ustawionego dla źródła zamówień" do
      shop = Inventory::Warehouse.create!(account:, name: "Punkt Y")
      Inventory.update_source_setting!(account, :live, warehouse_id: shop.id)

      delete "/inventory/warehouses/#{shop.id}"

      expect(flash[:alert]).to include("źródła zamówień")
    end
  end

  describe "katalogi" do
    it "tworzy katalog z zaznaczonymi magazynami i grupami cenowymi" do
      shop = Inventory::Warehouse.create!(account:, name: "Punkt Y")
      allegro = Inventory.price_groups(account).create!(name: "Allegro")

      post "/inventory/catalogs", params: { name: "Hurt", warehouse_ids: [ main.id, shop.id ], price_group_ids: [ allegro.id ] }

      hurt = Inventory.catalogs(account).find_by!(name: "Hurt")
      expect(Inventory.warehouses(account, catalog: hurt).map(&:name)).to eq([ "Magazyn główny", "Punkt Y" ])
      expect(Inventory.price_groups(account, catalog: hurt)).to eq([ allegro ])
      expect(Inventory.default_price_group(account, catalog: hurt)).to eq(allegro)
    end

    it "nie usuwa grupy cenowej, która jest jedyną grupą katalogu" do
      delete "/inventory/prices/#{retail.id}"
      allegro = Inventory.price_groups(account).create!(name: "Allegro")
      Inventory::Catalog.create!(account:, name: "Allegro only", warehouse_ids: [ main.id ], price_group_ids: [ allegro.id ])

      delete "/inventory/prices/#{allegro.id}"

      expect(flash[:alert]).to include("jedyna grupa cenowa katalogu")
      expect(Inventory.price_groups(account)).to include(allegro)
    end

    it "wymaga co najmniej jednego magazynu i jednej grupy cenowej" do
      post "/inventory/catalogs", params: { name: "Hurt", warehouse_ids: [], price_group_ids: [] }

      follow_redirect!
      expect(inertia.props[:errors].keys).to include("warehouse_ids", "price_group_ids")
    end

    it "nie pozwala odznaczyć magazynu z towarem produktów katalogu" do
      shop = Inventory::Warehouse.create!(account:, name: "Punkt Y")
      catalog.update!(warehouse_ids: [ main.id, shop.id ])
      product = create(:product, account:)
      Inventory.receive!(account, product.id, 2, warehouse_id: shop.id)

      patch "/inventory/catalogs/#{catalog.id}", params: { name: catalog.name, warehouse_ids: [ main.id ], price_group_ids: catalog.price_group_ids }

      follow_redirect!
      expect(inertia.props[:errors]["warehouse_ids"].first).to include("Punkt Y")
      expect(Inventory.warehouses(account, catalog:).count).to eq(2)
    end

    it "nie usuwa katalogu z produktami, a pusty usuwa (magazyny zostają)" do
      hurt = Inventory::Catalog.create!(account:, name: "Hurt", warehouse_ids: [ main.id ], price_group_ids: [ Inventory.default_price_group(account).id ])
      create(:product, account:)

      delete "/inventory/catalogs/#{catalog.id}"
      delete "/inventory/catalogs/#{hurt.id}"

      expect(Inventory.catalogs(account).map(&:name)).to eq([ "Domyślny" ])
      expect(Inventory.warehouses(account).count).to eq(1)
    end
  end

  it "dodaje grupę cenową, zmienia domyślną i nie usuwa domyślnej" do
    post "/inventory/prices", params: { name: "EU", currency: "EUR" }
    eu = Inventory.price_groups(account).find_by!(name: "EU")

    patch "/inventory/prices/#{eu.id}", params: { default: true }
    delete "/inventory/prices/#{eu.id}"

    expect(Inventory.default_price_group(account)).to eq(eu)
  end
end
