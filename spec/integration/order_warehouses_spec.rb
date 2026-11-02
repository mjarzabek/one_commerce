require "rails_helper"

# Zamówienia a magazyny: magazyn zamówienia wybierany per źródło (Produkty › Ustawienia › Ogólne › Źródła zamówień).
RSpec.describe "Magazyn zamówienia" do
  let(:account) { create(:account) }
  let!(:product) { create(:product, account:, price_cents: 1_000, stock: 5) }
  let(:shop) { Inventory.warehouses(account).create!(name: "Punkt Y") }

  def create_order(**options)
    Orders.create_from(account:, source: :live, items: [ { product_id: product.id, quantity: 2 } ], **options)
  end

  it "realizuje zamówienie z magazynu ustawionego dla źródła, bez pożyczania z innych" do
    Inventory.default_catalog(account).update!(warehouse_ids: Inventory.warehouses(account).ids + [ shop.id ])
    Inventory.receive!(account, product.id, 3, warehouse_id: shop.id)
    Inventory.update_source_setting!(account, :live, warehouse_id: shop.id)

    order = create_order

    expect(order.warehouse_id).to eq(shop.id)
    expect(Inventory.stock_levels(account, [ product.id ]).dig(product.id, shop.id)).to have_attributes(on_hand: 3, reserved: 2)
    expect { create_order(external_id: "druga") }.to raise_error(Inventory::InsufficientStock)
  end

  it "odrzuca zamówienie, gdy katalog produktu nie korzysta z magazynu źródła" do
    Inventory.update_source_setting!(account, :live, warehouse_id: shop.id)

    expect { create_order }.to raise_error(ActiveRecord::RecordNotFound, /nie korzysta z magazynu/)
  end

  it "domyślnie bierze pierwszy magazyn konta" do
    expect(create_order.warehouse_id).to eq(Inventory.warehouses(account).first.id)
  end

  describe "ręczne zmiany rezerwacji na karcie produktu a wysyłka i anulowanie" do
    let(:order) { create_order }
    let(:reservation) { Inventory.reservations_for(order).active.sole }
    let(:main) { Inventory.warehouses(account).first }

    def on_hand = Inventory.stock_levels(account, [ product.id ]).dig(product.id, main.id).on_hand

    it "nie zdejmuje drugi raz towaru zrealizowanego ręcznie" do
      Inventory.fulfill_reservation!(account, reservation.id)
      Orders.transition!(order, to: :processing)
      Orders.transition!(order, to: :shipped)

      expect(on_hand).to eq(3)
    end

    it "zdejmuje przy wysyłce towar z rezerwacji zwolnionej ręcznie" do
      Inventory.release_reservation!(account, reservation.id)
      Orders.transition!(order, to: :processing)
      Orders.transition!(order, to: :shipped)

      expect(on_hand).to eq(3)
    end

    it "przy anulowaniu przyjmuje z powrotem towar zrealizowany ręcznie" do
      Inventory.fulfill_reservation!(account, reservation.id)
      Orders.transition!(order, to: :cancelled)

      expect(on_hand).to eq(5)
    end

    it "opisuje rezerwację i ruch numerem zamówienia" do
      Inventory.fulfill_reservation!(account, reservation.id)

      expect(reservation.reload.holder_label).to eq("Zamówienie #{order.number}")
    end
  end
end
