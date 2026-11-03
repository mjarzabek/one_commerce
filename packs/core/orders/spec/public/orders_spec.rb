require "rails_helper"

RSpec.describe Orders do
  let(:account) { create(:account) }
  let(:main) { create(:main_product, account:, name: "Sukienka", tax_rate: 23) }
  let(:variant) { create(:variant, parent: main, sku: "SUK-M", name: "M", price_cents: 15_000, stock: 5) }

  def stock = Inventory.stock_items(account).find_by(product_id: variant.id)

  def create_order(**options)
    described_class.create_from(account:, source: :live, items: [ { product_id: variant.id, quantity: 2 } ],
      customer: { channel: "facebook", external_id: "fb-1", name: "Anna Kowalska" },
      shipping: { method: "InPost Paczkomat", price_cents: 1_500 }, **options)
  end

  describe ".create_from" do
    it "tworzy zamówienie z migawką pozycji, sumami, klientem i rezerwacją" do
      order = create_order

      expect(order).to have_attributes(status: "new", number: "#{Time.current.year}/000001", customer_name: "Anna Kowalska",
        subtotal_cents: 30_000, shipping_cents: 1_500, total_cents: 31_500, shipping_method: "InPost Paczkomat")
      expect(order.items.sole).to have_attributes(sku: "SUK-M", name: "Sukienka - M", unit_price_cents: 15_000, tax_rate: 23)
      expect(stock).to have_attributes(on_hand: 5, reserved: 2)
      expect(order.status_changes.sole).to have_attributes(from_status: nil, to_status: "new")
    end

    it "jest idempotentne po external_id" do
      first = create_order(external_id: "cart-1")
      second = create_order(external_id: "cart-1")

      expect(second).to eq(first)
      expect(stock.reserved).to eq(2)
    end

    it "nadaje kolejne numery w obrębie konta" do
      create_order
      other = described_class.create_from(account: create(:account), source: :manual,
        items: [ { name: "Usługa", quantity: 1, unit_price_cents: 100 } ])

      expect(create_order.number).to eq("#{Time.current.year}/000002")
      expect(other.number).to eq("#{Time.current.year}/000001")
    end

    it "przyjmuje pozycje spoza katalogu bez rezerwacji" do
      order = described_class.create_from(account:, source: :multichannel,
        items: [ { sku: "ALL-1", name: "Oferta Allegro", quantity: 1, unit_price_cents: 9_900 } ])

      expect(order.total_cents).to eq(9_900)
      expect(Inventory.reservations_for(order)).to be_empty
    end

    it "wycofuje wszystko przy braku towaru" do
      expect { described_class.create_from(account:, source: :live, items: [ { product_id: variant.id, quantity: 6 } ]) }
        .to raise_error(Inventory::InsufficientStock)
      expect(described_class.list(account).first).to be_empty
    end

    it "nie rezerwuje, gdy źródło ma wyłączone rezerwacje, i zdejmuje towar przy wysyłce" do
      Inventory.update_source_setting!(account, :live, enabled: false)
      order = create_order

      expect(order.stock_reserved).to be(false)
      expect(stock).to have_attributes(on_hand: 5, reserved: 0)

      described_class.transition!(order, to: :processing)
      described_class.transition!(order, to: :shipped)
      expect(stock).to have_attributes(on_hand: 3, reserved: 0)
    end

    it "bierze ceny i walutę z grupy cenowej" do
      variant
      eu = Inventory.price_groups(account).create!(name: "EU", currency: "EUR")
      Inventory.set_price!(account, variant.id, eu, 3_500)

      order = create_order(price_group: eu)

      expect(order).to have_attributes(currency: "EUR", subtotal_cents: 7_000)
    end

    it "odrzuca wariant bez ceny w grupie" do
      variant
      eu = Inventory.price_groups(account).create!(name: "EU", currency: "EUR")

      expect { create_order(price_group: eu) }.to raise_error(ArgumentError, /nie ma ceny/)
    end

    it "nie przyjmuje produktu głównego z wariantami" do
      expect { described_class.create_from(account:, source: :live, items: [ { product_id: main.tap { variant }.id, quantity: 1 } ]) }
        .to raise_error(ActiveRecord::RecordNotFound, /ma warianty/)
    end

    it "nie przyjmuje wariantu innego konta" do
      foreign = create(:product, stock: 1)

      expect { described_class.create_from(account:, source: :live, items: [ { product_id: foreign.id, quantity: 1 } ]) }
        .to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe ".transition!" do
    it "przy wysyłce zdejmuje towar ze stanu" do
      order = create_order
      described_class.transition!(order, to: :paid)
      described_class.transition!(order, to: :shipped)

      expect(order).to have_attributes(status: "shipped", payment_status: "paid")
      expect(stock).to have_attributes(on_hand: 3, reserved: 0)
      expect(order.status_changes.map(&:to_status)).to eq(%w[new paid shipped])
    end

    it "przy anulowaniu zwalnia rezerwację" do
      order = create_order
      described_class.transition!(order, to: :cancelled)

      expect(stock).to have_attributes(on_hand: 5, reserved: 0)
    end

    it "przy zwrocie przyjmuje towar z powrotem" do
      order = create_order
      described_class.transition!(order, to: :processing)
      described_class.transition!(order, to: :shipped)
      described_class.transition!(order, to: :returned)

      expect(stock).to have_attributes(on_hand: 5, reserved: 0)
    end

    it "odrzuca niedozwolone przejście" do
      order = create_order
      described_class.transition!(order, to: :cancelled)

      expect { described_class.transition!(order, to: :shipped) }.to raise_error(Orders::InvalidTransition)
    end
  end

  it "stronicuje listę kursorem od najnowszych" do
    Inventory.receive!(account, variant.id, 10)
    orders = Array.new(3) { create_order(external_id: "c#{_1}") }

    page, cursor = described_class.list(account, limit: 2)
    rest, last_cursor = described_class.list(account, limit: 2, cursor:)

    expect(page).to eq(orders.last(2).reverse)
    expect(rest).to eq([ orders.first ])
    expect(last_cursor).to be_nil
  end
end
