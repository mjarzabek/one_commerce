require "rails_helper"

RSpec.describe "Produkty - kategorie i producent", type: :request do
  let(:user) { create(:user, modules: [ :live ]) }
  let(:account) { user.accounts.first }
  let(:catalog) { Inventory.default_catalog(account) }
  let(:wholesale) { Inventory::Catalog.create!(account:, name: "Hurt", warehouse_ids: catalog.warehouse_ids, price_group_ids: catalog.price_group_ids) }

  before do
    sign_in(user)
    Inventory.ensure_setup!(account)
  end

  def category(name, **attrs) = Inventory::Category.create!(account:, name:, **attrs)

  describe "ustawienia → kategorie" do
    it "tworzy kategorię ogólną i podkategorię katalogu i pokazuje je jako drzewo" do
      post "/inventory/settings/categories", params: { name: "Odzież", catalog_id: "", parent_id: "" }
      clothes = Inventory::Category.find_by!(name: "Odzież")
      post "/inventory/settings/categories", params: { name: "Sukienki", catalog_id: catalog.id, parent_id: clothes.id }

      expect(clothes).to have_attributes(catalog_id: nil, source: "manual")
      get "/inventory/settings/categories"
      expect_inertia.to render_component("core/inventory/settings/categories")
      expect(inertia.props[:categories].map { _1.slice("path", "catalog_id", "source") }).to eq([
        { "path" => "Odzież", "catalog_id" => nil, "source" => "Ręczna" },
        { "path" => "Odzież › Sukienki", "catalog_id" => catalog.id, "source" => "Ręczna" }
      ])
    end

    it "nie pozwala na nadrzędną z innego katalogu, ogólną pod kategorią katalogu ani pętlę" do
      clothes = category("Odzież", catalog:)
      dresses = category("Sukienki", catalog:, parent: clothes)

      post "/inventory/settings/categories", params: { name: "Hurtowe", catalog_id: wholesale.id, parent_id: clothes.id }
      follow_redirect!
      expect(inertia.props[:errors]["parent_id"].sole).to include("ogólna albo z tego samego katalogu")

      post "/inventory/settings/categories", params: { name: "Ogólna", catalog_id: "", parent_id: clothes.id }
      follow_redirect!
      expect(inertia.props[:errors]["parent_id"].sole).to include("tylko ogólną")

      patch "/inventory/settings/categories/#{clothes.id}", params: { name: "Odzież", catalog_id: catalog.id, parent_id: dresses.id }
      follow_redirect!
      expect(inertia.props[:errors]["parent_id"].sole).to include("samej siebie")
    end

    it "usuwa kategorię - produkty zostają bez kategorii; kategorii z podkategoriami nie usuwa" do
      clothes = category("Odzież")
      dresses = category("Sukienki", parent: clothes)
      product = create(:product, account:, category: dresses)

      delete "/inventory/settings/categories/#{clothes.id}"
      expect(flash[:alert]).to include("z podkategoriami")

      delete "/inventory/settings/categories/#{dresses.id}"
      expect(product.reload.category_id).to be_nil
      expect(Inventory::Category.exists?(dresses.id)).to be(false)
    end
  end

  describe "karta produktu" do
    it "zapisuje producenta i kategorię ogólną albo katalogu produktu, ale nie z innego katalogu" do
      general = category("Odzież")
      other = category("Hurt", catalog: wholesale)
      product = create(:product, account:)

      patch "/inventory/products/#{product.id}", params: { product: { manufacturer: "  Lena  Design ", category_id: general.id } }, as: :json
      expect(product.reload).to have_attributes(manufacturer: "Lena Design", category_id: general.id)

      patch "/inventory/products/#{product.id}", params: { product: { category_id: other.id } }, as: :json
      follow_redirect!
      expect(inertia.props[:errors]["category_id"].sole).to include("innego katalogu")

      get "/inventory/products/#{product.id}/edit"
      expect(inertia.props[:product]).to include("manufacturer" => "Lena Design", "category_id" => general.id.to_s)
      expect(inertia.props[:categories].map { _1["path"] }).to eq([ "Odzież" ])
    end

    it "wariant dziedziczy producenta i kategorię, dopóki nie ustawi własnych" do
      clothes = category("Odzież")
      dresses = category("Sukienki", parent: clothes)
      main = create(:main_product, account:, manufacturer: "Lena", category: clothes)
      variant = create(:variant, parent: main)

      expect([ variant.effective(:manufacturer), variant.effective(:category_id) ]).to eq([ "Lena", clothes.id ])
      patch "/inventory/variants/#{variant.id}", params: { variant: { manufacturer: "Lena Kids", category_id: dresses.id } }, as: :json
      expect(variant.reload).to have_attributes(manufacturer: "Lena Kids", category_id: dresses.id)

      patch "/inventory/variants/#{variant.id}", params: { variant: { manufacturer: "", category_id: "" } }, as: :json
      expect([ variant.reload.manufacturer, variant.category_id, variant.effective(:category_id) ]).to eq([ nil, nil, clothes.id ])

      get "/inventory/variants/#{variant.id}/edit"
      expect(inertia.props[:inherited]).to include("manufacturer" => "Lena", "category_id" => clothes.id.to_s)
    end
  end

  describe "Inventory.import_categories!" do
    it "tworzy drzewo z marketplace'u i przy ponownym imporcie aktualizuje kategorie po external_id" do
      rows = [ { external_id: 2, name: "Sukienki", parent_external_id: 1 }, { external_id: 1, name: "Odzież" } ]
      imported = Inventory.import_categories!(account, source: "allegro", rows:)

      expect(imported["2"]).to have_attributes(source: "allegro", catalog_id: nil, parent: imported["1"])
      expect(imported["2"].path).to eq("Odzież › Sukienki")

      Inventory.import_categories!(account, source: "allegro", rows: [ { external_id: 2, name: "Sukienki damskie", parent_external_id: 1 } ])
      expect(Inventory::Category.where(account:).count).to eq(2)
      expect(imported["2"].reload).to have_attributes(name: "Sukienki damskie", parent_id: imported["1"].id)
    end
  end
end
