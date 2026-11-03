require "rails_helper"

RSpec.describe "Produkty - lista, produkty i warianty", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }
  let(:catalog) { Inventory.default_catalog(account) }
  let(:retail) { Inventory.default_price_group(account) }

  before do
    sign_in(user)
    Inventory.ensure_setup!(account)
  end

  def add_warehouse(name)
    Inventory::Warehouse.create!(account:, name:, position: 1).tap do |warehouse|
      catalog.update!(warehouse_ids: catalog.warehouse_ids + [ warehouse.id ])
    end
  end

  describe "lista" do
    it "pokazuje produkty proste i wariantowe z wariantami, ceną i stanem - łącznie albo w magazynie" do
      shop = add_warehouse("Punkt Y")
      create(:product, account:, name: "Kubek", sku: "KUBEK", price_cents: 4_900, stock: 2)
      lena = create(:main_product, account:, name: "Sukienka Lena", sku: "LENA")
      small = create(:variant, parent: lena, name: "S", sku: "LENA-S", price_cents: 19_900, stock: 3)
      Inventory.receive!(account, small.id, 1, warehouse_id: shop.id)
      create(:product, name: "Obcy")

      get "/inventory"

      expect_inertia.to render_component("core/inventory/products/index")
      kubek, dress = inertia.props[:products]
      expect(kubek).to include("name" => "Kubek", "sku" => "KUBEK", "price" => "49,00 zł", "stock" => 2, "variants" => [])
      expect(dress).to include("name" => "Sukienka Lena", "sku" => "LENA", "price" => "199,00 zł", "stock" => 4)
      expect(dress["variants"].sole).to include("name" => "S", "sku" => "LENA-S", "stock" => 4)
      expect(inertia.props[:warehouses].map { _1["name"] }).to eq([ "Magazyn główny", "Punkt Y" ])

      get "/inventory", params: { warehouse_id: shop.id }

      kubek, dress = inertia.props[:products]
      expect([ kubek["stock"], dress["stock"], dress["variants"].sole["stock"] ]).to eq([ 0, 1, 1 ])
    end

    describe "wyszukiwanie i filtry" do
      let!(:dress) { create(:main_product, account:, name: "Sukienka Lena", sku: "LENA") }
      let!(:small) { create(:variant, parent: dress, name: "S", sku: "LENA-S", ean: "5901111", price_cents: 19_900, stock: 6) }
      let!(:mug) { create(:product, account:, name: "Kubek", sku: "KUBEK", ean: "5902222", price_cents: 4_900, stock: 2) }
      let!(:draft) { create(:product, account:, name: "Szal", sku: "SZAL", price_cents: 9_900, status: :draft) }

      def names(params = {})
        get "/inventory", params: params
        inertia.props[:products].map { _1["name"] }
      end

      it "szuka po nazwie produktu i wariantu" do
        expect(names(q: "lena")).to eq([ "Sukienka Lena" ])
        expect(names(q: "kub")).to eq([ "Kubek" ])
      end

      it "filtruje osobno po SKU i EAN (także wariantów)" do
        expect(names(sku: "lena-s")).to eq([ "Sukienka Lena" ])
        expect(names(ean: "5902")).to eq([ "Kubek" ])
        expect(names(sku: "kubek", ean: "5901")).to eq([])
      end

      it "filtruje po cenie i stanie od-do" do
        expect(names(price_min: "50", price_max: "100")).to eq([ "Szal" ])
        expect(names(stock_min: "1", stock_max: "5")).to eq([ "Kubek" ])
        expect(names(stock_max: "0")).to eq([ "Szal" ])
      end

      it "filtruje po statusie i typie" do
        expect(names(status: "draft")).to eq([ "Szal" ])
        expect(names(kind: "variants")).to eq([ "Sukienka Lena" ])
        expect(names(kind: "simple").sort).to eq([ "Kubek", "Szal" ])
      end

      it "pokazuje i sortuje ceny wybranej grupy cenowej katalogu" do
        allegro = Inventory.price_groups(account).create!(name: "Allegro")
        catalog.update!(price_group_ids: [ retail.id, allegro.id ])
        Inventory.set_price!(account, mug.id, allegro, 99_900)

        get "/inventory", params: { price_group_id: allegro.id, sort: "price", dir: "desc" }

        expect(inertia.props[:priceGroups].map { _1["name"] }).to eq(%w[Detal Allegro])
        expect(inertia.props[:view]["price_group_id"]).to eq(allegro.id)
        expect(inertia.props[:products].first).to include("name" => "Kubek", "price" => "999,00 zł")
      end

      it "sortuje po cenie i stanie" do
        expect(names(sort: "price", dir: "desc")).to eq([ "Sukienka Lena", "Szal", "Kubek" ])
        expect(names(sort: "stock", dir: "asc")).to eq([ "Szal", "Kubek", "Sukienka Lena" ])
      end

      it "stronicuje i zwraca schemat oraz wartości filtrów" do
        get "/inventory", params: { per: 25, page: 1, price_min: "50,5" }

        expect(inertia.props[:pagination]).to include("page" => 1, "pages" => 1, "per" => 25, "total" => 2)
        expect(inertia.props[:filters]).to include("price_min" => "50,50", "price_max" => "", "sku" => "")
        expect(inertia.props[:view]).to include("sort" => "name", "dir" => "asc")
        expect(inertia.props[:filterSchema].map { _1["key"] }).to eq(%w[sku ean price stock status kind])
        expect(inertia.props[:filterSchema].find { _1["key"] == "price" }).to include("type" => "money_range", "params" => %w[price_min price_max])
      end

      it "pokazuje ostatnią stronę zamiast pustej i ignoruje nieobsługiwaną liczbę na stronę" do
        get "/inventory", params: { per: 25, page: 99 }
        expect(inertia.props[:pagination]).to include("page" => 1, "pages" => 1, "per" => 25, "total" => 3)
        expect(inertia.props[:products].size).to eq(3)

        get "/inventory", params: { per: 10 }
        expect(inertia.props[:pagination]).to include("per" => 50)
      end

      it "filtruje i sortuje po stanie całej rodziny (suma wariantów)" do
        expect(names(stock_min: "6")).to eq([ "Sukienka Lena" ])
        expect(names(sort: "stock", dir: "desc").first).to eq("Sukienka Lena")
      end
    end

    describe "akcje masowe" do
      let!(:mug) { create(:product, account:, name: "Kubek") }
      let!(:scarf) { create(:product, account:, name: "Szal") }
      let!(:stocked) { create(:product, account:, name: "Na stanie", stock: 1) }
      let!(:foreign) { create(:product, name: "Obcy") }

      it "zmienia status zaznaczonych produktów, ale nie produktów innego konta" do
        post "/inventory/products/bulk", params: { operation: "status", new_status: "archived", ids: [ mug.id, foreign.id ] }

        expect([ mug.reload.status, scarf.reload.status, foreign.reload.status ]).to eq(%w[archived active active])
        expect(flash[:notice]).to include("1 produkt")
      end

      it "usuwa zaznaczone i pomija produkty z towarem" do
        post "/inventory/products/bulk", params: { operation: "delete", ids: [ mug.id, stocked.id ] }

        expect(Inventory.products(account).map(&:name)).to contain_exactly("Szal", "Na stanie")
        expect(flash[:alert]).to include("Usunięto 1 produkt", "Pominięto 1 (Na stanie)")
      end

      it "działa na wszystkich produktach pasujących do filtrów (wszystkie strony)" do
        post "/inventory/products/bulk", params: { operation: "status", new_status: "draft", all: "true", q: "k", status: "active", per: 25 }

        expect(Inventory.products(account).where(status: "draft").map(&:name)).to eq([ "Kubek" ])
      end

      it "pomija produkty odznaczone ręcznie w trybie wszystkich stron" do
        post "/inventory/products/bulk", params: { operation: "status", new_status: "draft", all: "true", per: 25, excluded_ids: [ scarf.id ] }

        expect(Inventory.products(account).where(status: "draft").map(&:name)).to contain_exactly("Kubek", "Na stanie")
      end

      it "usuwa produkt wariantowy razem z wariantami" do
        main = create(:main_product, account:, name: "Sukienka")
        create(:variant, parent: main)

        delete "/inventory/products/#{main.id}"

        expect(response).to redirect_to("/inventory?catalog_id=#{catalog.id}")
        expect(Inventory.find_products(account, ids: [ main.id ])).to be_empty
        expect(Inventory.products(account).map(&:name)).not_to include("Sukienka")
      end
    end
  end

  describe "produkt prosty" do
    it "tworzy produkt z SKU, EAN i cenami" do
      post "/inventory/products", params: { product: { catalog_id: catalog.id, name: "Kubek", sku: "KUBEK", ean: "590", status: "active",
        tax_rate: "23", price_inputs: { retail.id => "49,90" } } }, as: :json

      product = Inventory.products(account).sole
      expect(response).to redirect_to("/inventory/products/#{product.id}/edit?tab=stock")
      expect([ product.sku, product.ean, product.price_cents_in(retail.id) ]).to eq([ "KUBEK", "590", 4_990 ])
    end

    it "zwraca błędy pól" do
      post "/inventory/products", params: { product: { catalog_id: catalog.id, name: "", sku: "", price_inputs: { retail.id => "abc" } } }, as: :json

      follow_redirect!
      expect(inertia.props[:errors].keys).to include("name", "sku", "prices.#{retail.id}")
    end

    it "pokazuje kartę ze stanami w magazynach" do
      product = create(:product, account:, stock: 3)

      get "/inventory/products/#{product.id}/edit"

      expect(inertia.props[:product]).to include("hasVariants" => false, "prices" => { retail.id.to_s => "100,00" })
      expect(inertia.props[:stock]["warehouses"].sole).to include("name" => "Magazyn główny", "on_hand" => 3)
    end

    it "edytuje stan w magazynach i zapisuje w historii, z ilu na ile i kto" do
      product = create(:product, account:, stock: 2)
      main = Inventory.warehouses(account).first
      shop = add_warehouse("Punkt Y")

      patch "/inventory/products/#{product.id}/stock", params: { stock: { main.id => "2", shop.id => "3" } }

      get "/inventory/products/#{product.id}/edit"
      expect(inertia.props[:stock]["warehouses"].map { _1["on_hand"] }).to eq([ 2, 3 ])
      expect(inertia.props[:stock]["movements"].first).to include(
        "reason" => "Zmiana ręczna", "before" => 0, "after" => 3, "quantity" => 3, "warehouse" => "Punkt Y", "user" => user.name
      )
      expect(inertia.props[:stock]["movements"].size).to eq(2)
    end

    it "nie zapisuje niepoprawnego stanu" do
      product = create(:product, account:, stock: 2)
      main = Inventory.warehouses(account).first

      patch "/inventory/products/#{product.id}/stock", params: { stock: { main.id => "-1" } },
        headers: { "HTTP_REFERER" => "/inventory/products/#{product.id}/edit" }

      follow_redirect!
      expect(inertia.props[:errors]["stock.#{main.id}"]).to eq([ "Podaj stan (0 lub więcej)" ])
      expect(inertia.props[:stock]["warehouses"].sole["on_hand"]).to eq(2)
    end
  end

  describe "produkt wariantowy" do
    let(:main) { create(:main_product, account:, name: "Sukienka Lena", sku: "LENA") }

    it "dodaje wariant z własnym SKU, EAN i ceną" do
      post "/inventory/products/#{main.id}/variants", params: { variant: { name: "M", sku: "LENA-M", ean: "222",
        price_inputs: { retail.id => "199,00" } } }, as: :json

      variant = main.variants.sole
      expect(response).to redirect_to("/inventory/variants/#{variant.id}/edit?tab=stock")
      expect([ variant.sku, variant.ean, variant.price_cents_in(retail.id) ]).to eq([ "LENA-M", "222", 19_900 ])
    end

    it "pokazuje kartę produktu głównego z wariantami i stanem wariant × magazyn" do
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M", stock: 2)
      warehouse = Inventory.warehouses(account).first

      get "/inventory/products/#{main.id}/edit"

      expect(inertia.props[:product]["hasVariants"]).to be(true)
      expect(inertia.props[:variants].sole).to include("name" => "M", "sku" => "LENA-M", "available" => 2)
      expect(inertia.props[:variants].sole["levels"]).to eq(warehouse.id.to_s => { "on_hand" => 2, "reserved" => 0 })
      expect(inertia.props[:summary]).to include("available" => 2, "price" => "100,00 zł")
      expect(inertia.props).not_to have_key(:stock)
      expect(variant).to be_persisted
    end

    it "wraca na zakładkę, z której zapisano" do
      patch "/inventory/products/#{main.id}?tab=variants", params: { product: { name: "Sukienka Lena 2" } }, as: :json

      expect(response).to redirect_to("/inventory/products/#{main.id}/edit?tab=variants")
    end

    it "edytuje wariant i pokazuje okruszki do produktu głównego" do
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M")

      patch "/inventory/variants/#{variant.id}", params: { variant: { name: "M", sku: "LENA-M2", ean: "", price_inputs: { retail.id => "5" } } }, as: :json
      get "/inventory/variants/#{variant.id}/edit"

      expect(inertia.props[:variant]).to include("sku" => "LENA-M2", "prices" => { retail.id.to_s => "5,00" })
      expect(inertia.props[:parent]).to include("name" => "Sukienka Lena")
    end

    it "usuwa wariant bez historii, ale nie z historią" do
      fresh = create(:variant, parent: main)
      used = create(:variant, parent: main, stock: 1)

      delete "/inventory/variants/#{fresh.id}"
      delete "/inventory/variants/#{used.id}"

      expect(main.variants.reload).to eq([ used ])
    end
  end

  it "pokazuje zakładkę Zestawy" do
    get "/inventory/bundles"

    expect_inertia.to render_component("core/inventory/bundles/index")
  end

  it "nie pozwala edytować produktu innego konta" do
    get "/inventory/products/#{create(:product).id}/edit"

    expect(response).to have_http_status(:not_found)
  end

  it "jest zablokowany bez panelu zamówień" do
    sign_in(create(:user, modules: [ :chat ]))

    get "/inventory"

    expect(response).to have_http_status(:forbidden)
  end
end
