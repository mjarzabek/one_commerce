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

      expect(order.status).to have_attributes(name: "Nowe", default: true)
      expect(order).to have_attributes(payment_status: "unpaid", number: "#{Time.current.year}/000001", customer_name: "Anna Kowalska",
        subtotal_cents: 30_000, shipping_cents: 1_500, total_cents: 31_500, shipping_method: "InPost Paczkomat")
      expect(order.items.sole).to have_attributes(sku: "SUK-M", name: "Sukienka - M", unit_price_cents: 15_000, tax_rate: 23)
      expect(stock).to have_attributes(on_hand: 5, reserved: 2)
      expect(order.status_changes.sole).to have_attributes(from_status: nil, to_status: "Nowe", to_status_id: order.status_id)
    end

    it "przy payment_status: :paid zapisuje wpłatę całej kwoty" do
      expect(create_order(payment_status: :paid)).to have_attributes(paid_cents: 31_500, payment_status: "paid")
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

    it "nie rezerwuje, gdy źródło ma wyłączone rezerwacje, i zdejmuje towar przy realizacji" do
      Inventory.update_source_setting!(account, :live, enabled: false)
      order = create_order

      expect(order.stock_reserved).to be(false)
      expect(stock).to have_attributes(on_hand: 5, reserved: 0)

      described_class.fulfill_stock!(order)
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

  describe ".ensure_setup!" do
    it "tworzy domyślne grupy i statusy raz" do
      2.times { described_class.ensure_setup!(account) }

      expect(described_class.status_groups(account).map(&:name)).to eq([ "Do realizacji", "Zakończone" ])
      expect(described_class.statuses(account).map(&:name))
        .to eq([ "Nowe", "Potwierdzone", "W realizacji", "Wysłane", "Dostarczone", "Anulowane", "Zwrócone" ])
      expect(described_class.default_status(account).name).to eq("Nowe")
    end
  end

  describe ".change_status!" do
    let(:shipped) { described_class.statuses(account).find_by!(name: "Wysłane") }
    let(:user) { create(:user) }

    it "zmienia status na dowolny i zapisuje historię bez ruchów w magazynie" do
      order = create_order
      described_class.change_status!(order, shipped, user:, note: "Kurier odebrał")

      expect(order.reload.status).to eq(shipped)
      expect(stock).to have_attributes(on_hand: 5, reserved: 2)
      expect(order.status_changes.last).to have_attributes(from_status: "Nowe", to_status: "Wysłane", to_status_id: shipped.id,
        user_id: user.id, note: "Kurier odebrał")
    end

    it "nie zapisuje historii, gdy status się nie zmienia" do
      order = create_order

      expect { described_class.change_status!(order, order.status_id) }.not_to(change { order.status_changes.count })
    end

    it "nie przyjmuje statusu innego konta" do
      order = create_order
      foreign = described_class.statuses(create(:account)).first

      expect { described_class.change_status!(order, foreign) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "zmienia status wielu zamówień i zwraca liczbę zmienionych" do
      Inventory.receive!(account, variant.id, 10)
      orders = Array.new(3) { create_order(external_id: "c#{_1}") }
      described_class.change_status!(orders.first, shipped)

      expect(described_class.change_statuses!(account, orders.map(&:id), shipped)).to eq(2)
      expect(orders.map { _1.reload.status_id }.uniq).to eq([ shipped.id ])
    end
  end

  describe "skutki w magazynie" do
    it "fulfill_stock! zdejmuje towar ze stanu" do
      order = create_order
      described_class.fulfill_stock!(order)

      expect(stock).to have_attributes(on_hand: 3, reserved: 0)
    end

    it "release_stock! zwalnia rezerwację" do
      order = create_order
      described_class.release_stock!(order)

      expect(stock).to have_attributes(on_hand: 5, reserved: 0)
    end

    it "restock! przyjmuje towar z powrotem po wysyłce" do
      order = create_order
      described_class.fulfill_stock!(order)
      described_class.restock!(order)

      expect(stock).to have_attributes(on_hand: 5, reserved: 0)
    end

    it "Inventory.stock_state śledzi rezerwację, zdjęcie ze stanu, zwrot i anulowanie" do
      shipped = create_order
      expect(Inventory.stock_state(shipped)).to eq(:reserved)
      described_class.fulfill_stock!(shipped)
      expect(Inventory.stock_state(shipped)).to eq(:deducted)
      described_class.restock!(shipped)
      expect(Inventory.stock_state(shipped)).to eq(:returned)

      cancelled = create_order(external_id: "cart-2")
      described_class.release_stock!(cancelled)
      expect(Inventory.stock_state(cancelled)).to eq(:cancelled)

      manual = described_class.create_from(account:, source: :manual, items: [ { name: "Usługa", quantity: 1, unit_price_cents: 100 } ])
      expect(Inventory.stock_state(manual)).to eq(:none)
    end
  end

  describe "statusy" do
    it "nie pozwala usunąć statusu domyślnego ani używanego" do
      order = create_order
      described_class.change_status!(order, described_class.statuses(account).find_by!(name: "Wysłane"))
      used = order.status
      unused = described_class.statuses(account).find_by!(name: "Zwrócone")

      expect(described_class.default_status(account).destroy).to be(false)
      expect(used.destroy).to be(false)
      expect(unused.destroy).to be_truthy
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

  describe ".update_payment!" do
    it "wylicza status płatności z kwoty wpłaconej" do
      order = create_order

      expect(described_class.update_payment!(order, paid_cents: 10_000).payment_status).to eq("partial")
      expect(described_class.update_payment!(order, paid_cents: 31_500).payment_status).to eq("paid")
      expect(described_class.update_payment!(order, paid_cents: 40_000)).to have_attributes(payment_status: "overpaid", overpaid_cents: 8_500)
      expect(described_class.update_payment!(order, paid_cents: 0).payment_status).to eq("unpaid")
    end

    it "przelicza status po zmianie wartości zamówienia" do
      order = described_class.update_payment!(create_order, paid_cents: 31_500)
      order.update!(shipping_cents: 2_000, total_cents: 32_000)

      expect(order).to have_attributes(payment_status: "partial", remaining_cents: 500)
    end

    it "rozpoznaje pobranie bez wpłaty i odrzuca złą kwotę lub metodę" do
      order = create_order(payment_method: :cod)

      expect(order).to be_cod_pending
      expect { described_class.update_payment!(order, paid_cents: nil) }.to raise_error(Orders::InvalidData)
      expect { described_class.update_payment!(order, paid_cents: 100, payment_method: "bitcoin") }.to raise_error(Orders::InvalidData)
    end
  end

  describe "pozycje" do
    let(:other) { create(:variant, parent: main, sku: "SUK-L", name: "L", price_cents: 16_000, stock: 3) }

    def stock_of(product) = Inventory.stock_items(account).find_by(product_id: product.id)

    it "dodaje produkt z katalogu z ceną z grupy, rezerwuje go i przelicza wartość" do
      order = create_order
      described_class.add_item!(order, product_id: other.id, quantity: 1)

      expect(order.items.reload.last).to have_attributes(sku: "SUK-L", unit_price_cents: 16_000, quantity: 1)
      expect(order.reload).to have_attributes(subtotal_cents: 46_000, total_cents: 47_500)
      expect(stock_of(other).reserved).to eq(1)
      expect(stock.reserved).to eq(2)
    end

    it "dodaje pozycję spoza katalogu i zmienia ilość z korektą rezerwacji" do
      order = create_order
      described_class.add_item!(order, name: "Pakowanie", quantity: 1, unit_price_cents: 500)
      described_class.update_item!(order, order.items.find_by!(sku: "SUK-M").id, quantity: 4, unit_price_cents: 14_000)

      expect(order.reload).to have_attributes(subtotal_cents: 56_500, total_cents: 58_000)
      expect(stock.reserved).to eq(4)
    end

    it "usuwa pozycję i zwalnia jej rezerwację, ale nie ostatnią" do
      order = create_order
      described_class.add_item!(order, product_id: other.id, quantity: 2)
      described_class.remove_item!(order, order.items.find_by!(sku: "SUK-L").id)

      expect(stock_of(other).reserved).to eq(0)
      expect(order.reload.total_cents).to eq(31_500)
      expect { described_class.remove_item!(order, order.items.sole.id) }.to raise_error(Orders::InvalidData, /co najmniej jedną/)
    end

    it "odrzuca ilość ponad stan i zmianę ilości po zdjęciu towaru ze stanu" do
      order = create_order
      expect { described_class.update_item!(order, order.items.sole.id, quantity: 9) }.to raise_error(Orders::InvalidData, /Za mało towaru/)
      expect(order.reload.total_cents).to eq(31_500)

      described_class.fulfill_stock!(order)
      expect { described_class.update_item!(order, order.items.sole.id, quantity: 1) }.to raise_error(Orders::InvalidData, /zszedł/)
      described_class.update_item!(order, order.items.sole.id, unit_price_cents: 10_000)
      expect(order.reload.subtotal_cents).to eq(20_000)
    end

    it "zwraca polskie błędy walidacji" do
      order = create_order
      expect { described_class.add_item!(order, name: "", quantity: 0, unit_price_cents: nil) }
        .to raise_error(Orders::InvalidData) { |e| expect(e.errors.keys).to contain_exactly("name", "quantity", "unit_price") }
    end
  end
end
