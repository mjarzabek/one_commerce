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

  # Lista dosyła produkty i stronicowanie osobnym zapytaniem (deferred) - w testach od razu je liczymy.
  around do |example|
    InertiaRails::Testing.evaluate_optional_props = true
    example.run
  ensure
    InertiaRails::Testing.evaluate_optional_props = false
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
      expect(kubek).to include("name" => "Kubek", "sku" => "KUBEK", "price" => "49,00 PLN", "stock" => 2, "variants" => [])
      expect(dress).to include("name" => "Sukienka Lena", "sku" => "LENA", "price" => "199,00 PLN", "stock" => 4)
      expect(dress["variants"].sole).to include("name" => "S", "sku" => "LENA-S", "stock" => 4)
      expect(inertia.props[:warehouses].map { _1["name"] }).to eq([ "Magazyn główny", "Punkt Y" ])

      get "/inventory", params: { warehouse_id: shop.id }

      kubek, dress = inertia.props[:products]
      expect([ kubek["stock"], dress["stock"], dress["variants"].sole["stock"] ]).to eq([ 0, 1, 1 ])
    end

    it "pokazuje miniaturę pierwszego zdjęcia albo nic, gdy produkt nie ma zdjęć" do
      mug = create(:product, account:, name: "Kubek")
      create(:product, account:, name: "Szal")
      mug.images.create!(file: fixture_file_upload("product.png", "image/png"))

      get "/inventory"

      kubek, szal = inertia.props[:products]
      expect(kubek["image"]).to start_with("/rails/active_storage/representations/")
      expect(szal["image"]).to be_nil
    end

    it "dosyła produkty i stronicowanie osobnym zapytaniem, a pasek narzędzi od razu" do
      InertiaRails::Testing.evaluate_optional_props = false
      create(:product, account:, name: "Kubek")

      get "/inventory"

      expect(inertia).to have_deferred_props(:products, :pagination, group: :list)
      expect(inertia.props.keys).not_to include(:products, :pagination)
      expect(inertia.props[:view]).to include("sort" => "name", "per" => 50)

      inertia_load_deferred_props(:list)

      expect(inertia.props[:products].sole).to include("name" => "Kubek")
      expect(inertia.props[:pagination]).to include("total" => 1)

      # Zmiana widoku z samej listy - produkty od razu, tabela tylko przygasa (bez skeletonu).
      get "/inventory", params: { sort: "id" }, headers: { "X-Inertia" => "true", "Referer" => "http://www.example.com/inventory?sort=name" }

      expect(inertia).not_to have_deferred_props
      expect(inertia.props[:products].sole).to include("name" => "Kubek")
    end

    describe "zapamiętany widok" do
      let!(:shop) { add_warehouse("Punkt Y") }
      let!(:allegro) do
        Inventory.price_groups(account).create!(name: "Allegro").tap { catalog.update!(price_group_ids: [ retail.id, _1.id ]) }
      end

      it "przy wejściu bez parametrów od razu renderuje ostatni widok, a adres ma pierwszeństwo" do
        get "/inventory", params: { sort: "price", dir: "desc", per: 100, warehouse_id: shop.id, price_group_id: allegro.id, q: "kub", sku: "X" }
        get "/inventory"

        expect(inertia.props[:view]).to include("sort" => "price", "dir" => "desc", "per" => 100, "warehouse_id" => shop.id,
          "price_group_id" => allegro.id, "q" => "")
        expect(inertia.props[:filters]).to include("sku" => "")

        get "/inventory", params: { sort: "id" }
        expect(inertia.props[:view]).to include("sort" => "id", "dir" => "desc", "per" => 100)
      end

      it "pamięta wybór wszystkich magazynów" do
        get "/inventory", params: { warehouse_id: shop.id }
        get "/inventory", params: { warehouse_id: "all" }
        get "/inventory"

        expect(inertia.props[:view]["warehouse_id"]).to be_nil
      end

      it "po zmianie katalogu nie przenosi magazynu i grupy cenowej, a usunięty katalog zastępuje domyślnym" do
        hurt = Inventory::Catalog.create!(account:, name: "Hurt", warehouse_ids: [ shop.id ], price_group_ids: [ retail.id, allegro.id ])
        get "/inventory", params: { catalog_id: hurt.id, warehouse_id: shop.id, price_group_id: allegro.id, sort: "price" }

        get "/inventory", params: { catalog_id: catalog.id }
        expect(inertia.props[:view]).to include("catalog_id" => catalog.id, "warehouse_id" => nil, "price_group_id" => retail.id, "sort" => "price")

        get "/inventory", params: { catalog_id: hurt.id, warehouse_id: shop.id }
        hurt.destroy!
        get "/inventory"
        expect(inertia.props[:view]).to include("catalog_id" => catalog.id, "sort" => "price")
      end
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

      it "szuka po ID produktu i wariantu i sortuje po ID" do
        expect(names(q: mug.id.to_s)).to eq([ "Kubek" ])
        expect(names(q: small.id.to_s)).to eq([ "Sukienka Lena" ])
        expect(names(sort: "id", dir: "desc")).to eq([ "Szal", "Kubek", "Sukienka Lena" ])
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
        expect(inertia.props[:products].first).to include("name" => "Kubek", "price" => "999,00 PLN")
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
        post "/inventory/products/bulk", params: { operation: "status", new_status: "draft", ids: [ mug.id, foreign.id ] }

        expect([ mug.reload.status, scarf.reload.status, foreign.reload.status ]).to eq(%w[draft active active])
        expect(flash[:notice]).to include("1 produkt")
      end

      it "odrzuca nieznany status" do
        post "/inventory/products/bulk", params: { operation: "status", new_status: "archived", ids: [ mug.id ] }

        expect(flash[:alert]).to eq("Nieznany status.")
        expect(mug.reload.status).to eq("active")
      end

      it "usuwa zaznaczone produkty, także z towarem, ale nie produkty innego konta" do
        post "/inventory/products/bulk", params: { operation: "delete", ids: [ mug.id, stocked.id, foreign.id ] }

        expect(Inventory.products(account).map(&:name)).to contain_exactly("Szal")
        expect(Inventory.find_products(foreign.account, ids: [ foreign.id ])).to be_present
        expect(flash[:notice]).to eq("Usunięto 2 produkty.")
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
      expect(response).to redirect_to("/inventory/products/#{product.id}/edit?tab=sales")
      expect([ product.sku, product.ean, product.price_cents_in(retail.id) ]).to eq([ "KUBEK", "590", 4_990 ])
    end

    it "zapisuje opisy dodatkowe, parametry i wymiary (cm, kg)" do
      product = create(:product, account:)

      patch "/inventory/products/#{product.id}", params: { product: {
        description: "Opis", description_extra_1: "Skład", description_extra_3: "Pielęgnacja",
        parameters: [ { name: " Materiał ", value: "bawełna" }, { name: "", value: "" } ],
        length_cm: "30", width_cm: "20,5", height_cm: "", weight_kg: "0,35"
      } }, as: :json

      product.reload
      expect([ product.description_extra_1, product.description_extra_2, product.description_extra_3 ]).to eq([ "Skład", nil, "Pielęgnacja" ])
      expect(product.parameters).to eq([ { "name" => "Materiał", "value" => "bawełna" } ])
      expect([ product.length_mm, product.width_mm, product.height_mm, product.weight_grams ]).to eq([ 300, 205, nil, 350 ])

      get "/inventory/products/#{product.id}/edit"
      expect(inertia.props[:product]).to include("width_cm" => "20,5", "weight_kg" => "0,35", "height_cm" => "")
    end

    it "zwraca błędy wymiarów i niepełnych parametrów" do
      product = create(:product, account:)

      patch "/inventory/products/#{product.id}", params: { product: { weight_kg: "abc", parameters: [ { name: "Kolor", value: "" } ] } }, as: :json

      follow_redirect!
      expect(inertia.props[:errors]).to include("weight_kg" => [ "Podaj liczbę, np. 12,5" ], "parameters.0.value" => [ "Podaj wartość parametru" ])
    end

    it "zapisuje historię cen z autorem i pokazuje ją na karcie" do
      product = create(:product, account:, price_cents: 10_000)

      patch "/inventory/products/#{product.id}", params: { product: { price_inputs: { retail.id => "89,90" } } }, as: :json
      patch "/inventory/products/#{product.id}", params: { product: { price_inputs: { retail.id => "" } } }, as: :json

      get "/inventory/products/#{product.id}/edit"
      removed, lowered, added = inertia.props[:activity]["priceChanges"]
      expect(removed).to include("before" => "89,90 PLN", "after" => "0,00 PLN", "direction" => "down", "user" => user.name, "priceGroup" => "Detal")
      expect(lowered).to include("before" => "100,00 PLN", "after" => "89,90 PLN", "direction" => "down")
      expect(added).to include("before" => nil, "after" => "100,00 PLN", "direction" => "set", "user" => nil)
    end

    it "zapisuje dane, ceny i stan razem, a przy błędnym stanie nie zapisuje niczego" do
      product = create(:product, account:, name: "Kubek", stock: 2)
      main = Inventory.warehouses(account).first

      patch "/inventory/products/#{product.id}?tab=sales", params: { product: { name: "Kubek 2" }, stock: { main.id => "-1" } }, as: :json

      expect(response).to redirect_to("/inventory/products/#{product.id}/edit?tab=sales")
      follow_redirect!
      expect(inertia.props[:errors]["stock.#{main.id}"]).to eq([ "Podaj stan (0 lub więcej)" ])
      expect(product.reload.name).to eq("Kubek")

      patch "/inventory/products/#{product.id}", params: { product: { name: "Kubek 2" }, stock: { main.id => "7" } }, as: :json

      expect(product.reload.name).to eq("Kubek 2")
      expect(Inventory.available(account, [ product.id ])).to eq(product.id => 7)
    end

    it "usuwa produkt z towarem i historią" do
      product = create(:product, account:, name: "Stary kubek", stock: 3)

      delete "/inventory/products/#{product.id}"

      expect(response).to redirect_to("/inventory?catalog_id=#{catalog.id}")
      expect(Inventory.products(account)).to be_empty
      expect(Inventory.stock_items(account)).to be_empty
    end

    it "duplikuje produkt jako szkic z cenami, zdjęciami i wariantami - bez stanu, z nowym SKU" do
      main = create(:main_product, account:, name: "Sukienka", sku: "LENA", ean: "590", description: "Opis",
        parameters: [ { name: "Materiał", value: "len" } ], weight_kg: "0,4")
      source_variant = create(:variant, parent: main, name: "M", sku: "LENA-M", price_cents: 12_900, stock: 2, tax_rate: 8, description: "Opis M")
      main.images.create!(file: fixture_file_upload("product.png", "image/png"))
      source_variant.images.create!(file: fixture_file_upload("product.png", "image/png"))

      post "/inventory/products/#{main.id}/duplicate"
      post "/inventory/products/#{main.id}/duplicate"

      copy, second = Inventory::Product.main.where(account:).where.not(id: main.id).order(:id).to_a
      expect(response).to redirect_to("/inventory/products/#{second.id}/edit")
      expect(copy).to have_attributes(name: "Sukienka (kopia)", sku: "LENA-KOPIA", ean: nil, status: "draft",
        description: "Opis", parameters: [ { "name" => "Materiał", "value" => "len" } ], weight_grams: 400)
      expect(second.sku).to eq("LENA-KOPIA-2")
      expect(copy.images.sole.file.download).to eq(main.images.sole.file.download)
      variant = copy.variants.sole
      expect([ variant.name, variant.sku, variant.price_cents_in(retail.id) ]).to eq([ "M", "LENA-M-KOPIA", 12_900 ])
      expect([ variant.tax_rate, variant.description, variant.images.size ]).to eq([ 8, "Opis M", 1 ])
      expect(Inventory.available(account, [ variant.id ])).to eq(variant.id => 0)
    end

    it "pokazuje w formularzu tylko statusy Szkic i Aktywny" do
      get "/inventory/products/#{create(:product, account:).id}/edit"

      expect(inertia.props[:statuses]).to eq("active" => "Aktywny", "draft" => "Szkic")
    end

    describe "zdjęcia" do
      let(:product) { create(:product, account:) }
      let(:png) { fixture_file_upload("product.png", "image/png") }

      it "dodaje zdjęcia, zmienia kolejność (pierwsze = główne) i usuwa" do
        post "/inventory/products/#{product.id}/images", params: { images: [ png, fixture_file_upload("product.png", "image/png") ] }

        first, second = product.images.reload
        expect(flash[:notice]).to eq("Dodano zdjęcia.")

        patch "/inventory/images/#{second.id}", params: { position: 0 }
        expect(product.images.reload).to eq([ second, first ])

        get "/inventory/products/#{product.id}/edit"
        expect(inertia.props[:images].map { _1["id"] }).to eq([ second.id, first.id ])
        expect(inertia.props[:images].first["url"]).to include("/rails/active_storage/blobs/")

        delete "/inventory/images/#{second.id}"
        expect(product.images.reload).to eq([ first ])
      end

      it "odrzuca pliki, które nie są zdjęciami" do
        post "/inventory/products/#{product.id}/images", params: { images: [ fixture_file_upload("notes.txt", "text/plain") ] }

        expect(flash[:alert]).to include("musi być zdjęciem")
        expect(product.images).to be_empty
      end

      it "nie pozwala zmieniać zdjęć produktu innego konta" do
        foreign = create(:product)

        post "/inventory/products/#{foreign.id}/images", params: { images: [ png ] }

        expect(response).to have_http_status(:not_found)
      end
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

      patch "/inventory/products/#{product.id}", params: { product: { name: product.name }, stock: { main.id => "2", shop.id => "3" } }, as: :json

      get "/inventory/products/#{product.id}/edit"
      expect(inertia.props[:stock]["warehouses"].map { _1["on_hand"] }).to eq([ 2, 3 ])
      expect(inertia.props[:activity]["movements"].first).to include(
        "reason" => "Zmiana ręczna", "before" => 0, "after" => 3, "quantity" => 3, "warehouse" => "Punkt Y", "user" => user.name,
        "product" => nil
      )
      expect(inertia.props[:activity]["movements"].size).to eq(2)
    end

    it "pokazuje stan z rezerwacjami i dane do edycji ceny tylko dla produktów sprzedawalnych" do
      mug = create(:product, account:, name: "Kubek", price_cents: 4_990, stock: 5)
      dress = create(:main_product, account:, name: "Sukienka")
      small = create(:variant, parent: dress, name: "S", price_cents: 19_900, stock: 4)
      holder = create(:customer, account:)
      main = Inventory.warehouses(account).first
      Inventory.reserve!(account, mug.id, 2, holder:, warehouse_id: main.id)
      Inventory.reserve!(account, small.id, 1, holder:, warehouse_id: main.id)

      get "/inventory"

      mug_row, dress_row = inertia.props[:products].sort_by { _1["name"] }
      expect(mug_row).to include("stock" => 3, "reserved" => 2, "sellable" => true, "priceInput" => "49,90")
      expect(dress_row).to include("stock" => 3, "reserved" => 1, "sellable" => false, "priceInput" => nil)
      expect(dress_row["variants"].sole).to include("stock" => 3, "reserved" => 1, "sellable" => true, "priceInput" => "199,00")
      expect(inertia.props[:warehouses].sole).to include("strict_control" => false)
    end

    it "ustawia dostępne sztuki z listy, zostawiając rezerwacje" do
      product = create(:product, account:, stock: 5)
      main = Inventory.warehouses(account).first
      Inventory.reserve!(account, product.id, 2, holder: create(:customer, account:), warehouse_id: main.id)

      patch "/inventory/products/#{product.id}/available", params: { warehouse_id: main.id, available: "10" },
        headers: { "HTTP_REFERER" => "/inventory" }

      expect(response).to redirect_to("/inventory")
      item = Inventory.stock_levels(account, [ product.id ]).dig(product.id, main.id)
      expect([ item.on_hand, item.reserved ]).to eq([ 12, 2 ])
      expect(Inventory::Movement.where(product:).order(:id).last).to have_attributes(on_hand_before: 5, on_hand_after: 12, user_id: user.id)
    end

    it "zmienia i usuwa cenę z listy, odrzuca błędną kwotę i produkt z wariantami" do
      product = create(:product, account:, price_cents: 10_000)
      dress = create(:main_product, account:)
      create(:variant, parent: dress)
      referer = { "HTTP_REFERER" => "/inventory" }

      patch "/inventory/products/#{product.id}/price", params: { price_group_id: retail.id, price: "129,90" }, headers: referer
      expect(product.reload.price_cents_in(retail.id)).to eq(12_990)
      expect(response).to redirect_to("/inventory")

      patch "/inventory/products/#{product.id}/price", params: { price_group_id: retail.id, price: "abc" }, headers: referer
      follow_redirect!
      expect(inertia.props[:errors]["price"]).to include("Nieprawidłowa kwota")
      expect(product.reload.price_cents_in(retail.id)).to eq(12_990)

      patch "/inventory/products/#{product.id}/price", params: { price_group_id: retail.id, price: "" }, headers: referer
      expect(product.reload.price_cents_in(retail.id)).to be_nil

      patch "/inventory/products/#{dress.id}/price", params: { price_group_id: retail.id, price: "10" }, headers: referer
      follow_redirect!
      expect(inertia.props[:errors]["price"]).to include("wariantami")
    end

    it "nie zmienia z listy stanu w magazynie ze ścisłą kontrolą ani niepoprawnej liczby" do
      product = create(:product, account:, stock: 2)
      main = Inventory.warehouses(account).first
      referer = { "HTTP_REFERER" => "/inventory" }

      patch "/inventory/products/#{product.id}/available", params: { warehouse_id: main.id, available: "-1" }, headers: referer
      follow_redirect!
      expect(inertia.props[:errors]["available"]).to eq("Podaj stan (0 lub więcej)")

      main.update!(strict_control: true)
      patch "/inventory/products/#{product.id}/available", params: { warehouse_id: main.id, available: "5" }, headers: referer
      follow_redirect!
      expect(inertia.props[:errors]["available"]).to include("ścisłą kontrolę")
      expect(Inventory.available(account, [ product.id ])).to eq(product.id => 2)
    end

    it "nie zmienia stanu w magazynie ze ścisłą kontrolą" do
      product = create(:product, account:, stock: 2)
      main = Inventory.warehouses(account).first
      main.update!(strict_control: true)

      patch "/inventory/products/#{product.id}", params: { product: { name: product.name }, stock: { main.id => "5" } }, as: :json

      follow_redirect!
      expect(inertia.props[:errors]["stock.#{main.id}"].sole).to include("ścisłą kontrolę")
      expect(inertia.props[:stock]["warehouses"].sole["on_hand"]).to eq(2)
    end
  end

  describe "produkt wariantowy" do
    let(:main) { create(:main_product, account:, name: "Sukienka Lena", sku: "LENA") }

    it "dodaje wariant z własnym SKU, EAN i ceną" do
      post "/inventory/products/#{main.id}/variants", params: { variant: { name: "M", sku: "LENA-M", ean: "222",
        price_inputs: { retail.id => "199,00" } } }, as: :json

      variant = main.variants.sole
      expect(response).to redirect_to("/inventory/variants/#{variant.id}/edit?tab=sales")
      expect([ variant.sku, variant.ean, variant.price_cents_in(retail.id) ]).to eq([ "LENA-M", "222", 19_900 ])
      expect([ variant.tax_rate, variant.description, variant.effective_tax_rate ]).to eq([ nil, nil, 23 ])
    end

    it "zapisuje własne pola wariantu, a puste dziedziczy z produktu głównego" do
      main.update!(tax_rate: 23, description: "Opis sukienki", description_extra_1: "Skład: len", weight_grams: 400,
        parameters: [ { name: "Materiał", value: "len" }, { name: "Kolor", value: "beżowy" } ])
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M")

      patch "/inventory/variants/#{variant.id}", params: { variant: {
        tax_rate: "8", description: "Opis wariantu", description_extra_1: nil, weight_kg: "", height_cm: "12,5",
        status: "draft", parameters: [ { name: "kolor", value: "czarny" }, { name: "Rozmiar", value: "M" } ]
      } }, as: :json

      variant.reload
      expect(variant).to have_attributes(tax_rate: 8, description: "Opis wariantu", description_extra_1: nil, weight_grams: nil,
        height_mm: 125, status: "draft")
      expect(variant.effective(:description_extra_1)).to eq("Skład: len")
      expect(variant.effective(:weight_grams)).to eq(400)
      expect(variant.effective_parameters).to eq([ { "name" => "Materiał", "value" => "len" }, { "name" => "kolor", "value" => "czarny" },
                                                   { "name" => "Rozmiar", "value" => "M" } ])
      expect(Inventory.find_products(account, ids: [ variant.id ]).sole.tax_rate).to eq(8)

      get "/inventory/variants/#{variant.id}/edit"
      expect(inertia.props[:variant]).to include("tax_rate" => "8", "description" => "Opis wariantu", "description_extra_1" => nil,
        "weight_kg" => "", "height_cm" => "12,5")
      expect(inertia.props[:inherited]).to include("tax_rate" => "23", "description_extra_1" => "Skład: len", "weight_kg" => "0,4")
    end

    it "przywraca dziedziczenie VAT po wybraniu „jak produkt główny”" do
      variant = create(:variant, parent: main, tax_rate: 8)

      patch "/inventory/variants/#{variant.id}", params: { variant: { tax_rate: "" } }, as: :json

      expect(variant.reload.tax_rate).to be_nil
      expect(variant.effective_tax_rate).to eq(23)
    end

    it "dodaje zdjęcia wariantu i pokazuje po nich zdjęcia produktu głównego" do
      main.images.create!(file: fixture_file_upload("product.png", "image/png"))
      variant = create(:variant, parent: main)

      post "/inventory/products/#{variant.id}/images", params: { images: [ fixture_file_upload("product.png", "image/png") ] }

      expect(response).to redirect_to("/inventory/variants/#{variant.id}/edit")
      expect(variant.reload.images.size).to eq(1)
      expect(variant.effective_images.map(&:product_id)).to eq([ variant.id, main.id ])
      get "/inventory/variants/#{variant.id}/edit"
      expect(inertia.props[:images].size).to eq(1)
      expect(inertia.props[:inherited]["images"].size).to eq(1)
    end

    it "pokazuje kartę produktu głównego z wariantami i stanem wariant × magazyn" do
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M", stock: 2)
      warehouse = Inventory.warehouses(account).first

      get "/inventory/products/#{main.id}/edit"

      expect(inertia.props[:product]["hasVariants"]).to be(true)
      expect(inertia.props[:variants].sole).to include("name" => "M", "sku" => "LENA-M", "available" => 2)
      expect(inertia.props[:variants].sole["levels"]).to eq(warehouse.id.to_s => { "on_hand" => 2, "reserved" => 0 })
      expect(inertia.props[:summary]).to include("available" => 2, "price" => "100,00 PLN")
      expect(inertia.props).not_to have_key(:stock)
      expect(variant).to be_persisted
    end

    it "wraca na zakładkę, z której zapisano" do
      patch "/inventory/products/#{main.id}?tab=sales", params: { product: { name: "Sukienka Lena 2" } }, as: :json

      expect(response).to redirect_to("/inventory/products/#{main.id}/edit?tab=sales")
    end

    it "pokazuje historię i rezerwacje wszystkich wariantów z nazwą wariantu" do
      small = create(:variant, parent: main, name: "S", stock: 3)
      Inventory.reserve!(account, small.id, 1, holder: create(:customer, account:), warehouse_id: Inventory.warehouses(account).first.id)

      get "/inventory/products/#{main.id}/edit"

      activity = inertia.props[:activity]
      expect(activity["movements"].sole).to include("product" => "S", "after" => 3)
      expect(activity["priceChanges"].sole).to include("product" => "S", "after" => "100,00 PLN")
      expect(activity["reservations"].sole).to include("product" => "S", "quantity" => 1)
      expect(inertia.props[:reservationsEnabled]).to be(true)
    end

    it "zapisuje wariant razem ze stanem" do
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M")
      warehouse = Inventory.warehouses(account).first

      patch "/inventory/variants/#{variant.id}", params: { variant: { name: "M", sku: "LENA-M" }, stock: { warehouse.id => "4" } }, as: :json

      expect(Inventory.available(account, [ variant.id ])).to eq(variant.id => 4)
      get "/inventory/variants/#{variant.id}/edit"
      expect(inertia.props[:activity]["movements"].sole).to include("after" => 4)
      expect(inertia.props[:inherited]).to include("tax_rate" => "23")
    end

    it "edytuje wariant i pokazuje okruszki do produktu głównego" do
      variant = create(:variant, parent: main, name: "M", sku: "LENA-M")

      patch "/inventory/variants/#{variant.id}", params: { variant: { name: "M", sku: "LENA-M2", ean: "", price_inputs: { retail.id => "5" } } }, as: :json
      get "/inventory/variants/#{variant.id}/edit"

      expect(inertia.props[:variant]).to include("sku" => "LENA-M2", "prices" => { retail.id.to_s => "5,00" })
      expect(inertia.props[:parent]).to include("name" => "Sukienka Lena")
    end

    it "usuwa wariant, także z towarem i historią" do
      fresh = create(:variant, parent: main)
      used = create(:variant, parent: main, stock: 1)

      delete "/inventory/variants/#{fresh.id}"
      delete "/inventory/variants/#{used.id}"

      expect(main.variants.reload).to be_empty
    end

    it "po usunięciu wariantu wraca na zakładkę Warianty" do
      variant = create(:variant, parent: main)

      delete "/inventory/variants/#{variant.id}"

      expect(response).to redirect_to("/inventory/products/#{main.id}/edit?tab=variants")
    end

    it "podpowiada ceny nowego wariantu z ostatniego wariantu, a pierwszego - z produktu" do
      simple = create(:product, account:, price_cents: 4_990)
      get "/inventory/products/#{simple.id}/variants/new"
      expect(inertia.props[:variant]["prices"]).to include(retail.id.to_s => "49,90")

      create(:variant, parent: main, price_cents: 12_900)
      get "/inventory/products/#{main.id}/variants/new"
      expect(inertia.props[:variant]["prices"]).to include(retail.id.to_s => "129,00")
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
