require "rails_helper"

RSpec.describe Inventory do
  let(:account) { create(:account) }
  let(:catalog) { described_class.default_catalog(account) }
  let(:main) { catalog.warehouses.first }
  let(:shop) do
    Inventory::Warehouse.create!(account:, name: "Punkt Y", position: 1).tap do |warehouse|
      catalog.update!(warehouse_ids: catalog.warehouse_ids + [ warehouse.id ])
    end
  end
  let(:product) { create(:product, account:) }
  let(:holder) { create(:customer, account:) }

  def level(warehouse) = described_class.stock_levels(account, [ product.id ]).dig(product.id, warehouse.id)

  describe ".ensure_setup!" do
    it "tworzy magazyn główny, domyślny katalog z tym magazynem i grupę cenową – tylko raz" do
      2.times { described_class.ensure_setup!(account) }

      expect(described_class.catalogs(account).sole).to have_attributes(name: "Domyślny")
      expect(described_class.warehouses(account).sole.name).to eq("Magazyn główny")
      expect(described_class.warehouses(account, catalog:).sole.name).to eq("Magazyn główny")
      expect(described_class.price_groups(account).sole).to have_attributes(name: "Detal", default: true)
    end
  end

  describe "produkty proste i wariantowe" do
    it "tworzy produkt prosty z SKU, EAN i cenami w kilku grupach" do
      retail = described_class.default_price_group(account)
      allegro = described_class.price_groups(account).create!(name: "Allegro")
      kubek = described_class.create_product!(account, { name: "Kubek", sku: "KUBEK", ean: "590123",
        prices: { retail.id => 4_900, allegro.id => 5_400 } })

      info = described_class.find_products(account, ids: [ kubek.id ]).sole
      expect(info).to have_attributes(name: "Kubek", sku: "KUBEK", ean: "590123", price_cents: 4_900)
      expect(described_class.find_products(account, ids: [ kubek.id ], price_group: allegro).sole.price_cents).to eq(5_400)
    end

    it "tworzy produkt wariantowy – produkt główny z własnym SKU i warianty z własnymi SKU i cenami" do
      lena = described_class.create_product!(account, { name: "Sukienka Lena", sku: "LENA", ean: "111" },
        variants: [ { name: "S", sku: "LENA-S", ean: "222", price_cents: 19_900 }, { name: "M", sku: "LENA-M", price_cents: 21_900 } ])

      expect(lena.variants.map(&:sku)).to eq(%w[LENA-S LENA-M])
      expect(described_class.find_products(account, ids: [ lena.id, *lena.variants.map(&:id) ]).map(&:name))
        .to contain_exactly("Sukienka Lena – S", "Sukienka Lena – M")
    end

    it "wymaga SKU produktu prostego i wariantu, ale nie produktu głównego z wariantami" do
      expect { described_class.create_product!(account, { name: "Bez SKU" }) }.to raise_error(ActiveRecord::RecordInvalid, /SKU/i)

      lena = described_class.create_product!(account, { name: "Lena" }, variants: [ { name: "S", sku: "L-S" } ])
      expect(lena.sku).to be_nil
    end

    it "pilnuje unikalności SKU w katalogu (także między produktem a wariantem), ale nie między katalogami" do
      described_class.create_product!(account, { name: "Lena", sku: "X" }, variants: [ { name: "S", sku: "X-S" } ])
      other = Inventory::Catalog.create!(account:, name: "Hurt", warehouse_ids: [ main.id ], price_group_ids: [ Inventory.default_price_group(account).id ])

      expect { described_class.create_product!(account, { name: "Inny", sku: "X-S" }) }.to raise_error(ActiveRecord::RecordInvalid)
      expect(described_class.create_product!(account, { name: "Inny", sku: "X-S" }, catalog: other)).to be_persisted
    end

    it "nie pozwala dodać wariantów do produktu z towarem na stanie" do
      described_class.receive!(account, product.id, 1)

      variant = product.variants.build(name: "M", sku: "NEW-M")
      expect(variant.save).to be(false)
      expect(variant.errors[:base].first).to include("ma towar na stanie")
    end

    it "nie zwraca produktów innego konta" do
      expect(described_class.find_products(create(:account), ids: [ product.id ])).to be_empty
    end
  end

  describe "stany w wielu magazynach" do
    before do
      described_class.receive!(account, product.id, 2)
      described_class.receive!(account, product.id, 3, warehouse_id: shop.id)
    end

    it "przyjmuje do pierwszego magazynu domyślnie i liczy stan łączny oraz stan magazynu" do
      expect(level(main).on_hand).to eq(2)
      expect(level(shop).on_hand).to eq(3)
      expect(described_class.available(account, [ product.id ])).to eq(product.id => 5)
      expect(described_class.available(account, [ product.id ], warehouse_id: shop.id)).to eq(product.id => 3)
    end

    it "sumuje stan produktu głównego z wariantów" do
      main_product = create(:main_product, account:)
      small = create(:variant, parent: main_product, stock: 2)
      create(:variant, parent: main_product, stock: 4)

      expect(described_class.available(account, [ main_product.id, small.id ])).to eq(main_product.id => 6, small.id => 2)
    end

    it "rezerwuje w magazynie zamówienia i nie pożycza towaru z innych magazynów" do
      described_class.reserve!(account, product.id, 3, holder:, warehouse_id: shop.id)

      expect(level(shop)).to have_attributes(on_hand: 3, reserved: 3)
      expect(level(main)).to have_attributes(on_hand: 2, reserved: 0)
      expect { described_class.reserve!(account, product.id, 1, holder:, warehouse_id: shop.id) }.to raise_error(Inventory::InsufficientStock)
    end

    it "nie rezerwuje produktu głównego z wariantami" do
      main_product = create(:main_product, account:)
      create(:variant, parent: main_product)

      expect { described_class.reserve!(account, main_product.id, 1, holder:, warehouse_id: main.id) }.to raise_error(Inventory::NotSellable)
    end

    it "wydaje i zwalnia rezerwacje" do
      described_class.reserve!(account, product.id, 2, holder:, warehouse_id: main.id)
      described_class.commit!(holder)
      expect(level(main)).to have_attributes(on_hand: 0, reserved: 0)

      other = create(:customer, account:)
      described_class.reserve!(account, product.id, 1, holder: other, warehouse_id: shop.id)
      described_class.release!(other)
      expect(level(shop)).to have_attributes(on_hand: 3, reserved: 0)
    end

    it "wydaje bez rezerwacji i przyjmuje zwrot do tego samego magazynu" do
      described_class.deduct!(account, product.id, 2, holder:, warehouse_id: shop.id)
      expect(described_class.available(account, [ product.id ])).to eq(product.id => 3)

      2.times { described_class.restock!(holder) }
      expect([ level(main).on_hand, level(shop).on_hand ]).to eq([ 2, 3 ])
    end

    it "zapisuje w historii stan przed i po każdym ruchu" do
      described_class.set_on_hand!(account, product.id, 7)
      described_class.deduct!(account, product.id, 3, holder:, warehouse_id: main.id)

      movements = Inventory::Movement.where(product:, warehouse: main).order(:id).map { [ _1.on_hand_before, _1.quantity, _1.on_hand_after ] }
      expect(movements).to eq([ [ 0, 2, 2 ], [ 2, 5, 7 ], [ 7, -3, 4 ] ])
    end

    it "ręcznie zwalnia i realizuje pojedynczą rezerwację" do
      first = described_class.reserve!(account, product.id, 1, holder:, warehouse_id: main.id)
      second = described_class.reserve!(account, product.id, 1, holder: create(:customer, account:), warehouse_id: main.id)

      described_class.release_reservation!(account, first.id)
      described_class.fulfill_reservation!(account, second.id)

      expect(level(main)).to have_attributes(on_hand: 1, reserved: 0)
      expect(Inventory::Movement.where(product:).order(:id).last).to have_attributes(quantity: -1, on_hand_before: 2, on_hand_after: 1)
      expect { described_class.release_reservation!(account, first.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "nie pozwala zejść poniżej zarezerwowanych przy korekcie" do
      described_class.reserve!(account, product.id, 2, holder:, warehouse_id: main.id)

      expect { described_class.set_on_hand!(account, product.id, 1) }.to raise_error(ActiveRecord::RecordInvalid)
    end

    it "odrzuca magazyn, z którego katalog produktu nie korzysta" do
      unused = Inventory::Warehouse.create!(account:, name: "Nieużywany")

      expect { described_class.receive!(account, product.id, 1, warehouse_id: unused.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "liczy stan łączny tylko z magazynów katalogu" do
      Inventory::Catalog.find(catalog.id).update!(warehouse_ids: [ main.id, shop.id ])
      hurt = Inventory::Catalog.create!(account:, name: "Hurt", warehouse_ids: [ shop.id ], price_group_ids: [ Inventory.default_price_group(account).id ])
      wholesale = create(:product, account:, catalog: hurt)
      described_class.receive!(account, wholesale.id, 7)

      expect(described_class.available(account, [ wholesale.id, product.id ])).to eq(wholesale.id => 7, product.id => 5)
    end
  end

  it "ustawia magazyn i rezerwacje per źródło zamówień" do
    described_class.ensure_setup!(account)
    shop = Inventory::Warehouse.create!(account:, name: "Punkt Y")
    described_class.update_source_setting!(account, :ecommerce, enabled: false, warehouse_id: shop.id)

    settings = described_class.source_settings(account)
    expect(settings["ecommerce"]).to eq(enabled: false, warehouse_id: shop.id)
    expect(settings["live"]).to eq(enabled: true, warehouse_id: described_class.warehouses(account).first.id)
    expect(described_class.warehouse_for_source(account, :ecommerce)).to eq(shop.id)
  end

  it "parsuje kwoty w polskim zapisie" do
    expect([ "199,90", "1 299", "5.5", "abc", "1,999" ].map { described_class.parse_money(_1) }).to eq([ 19_990, 129_900, 550, nil, nil ])
  end
end
