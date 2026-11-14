module Orders
  # Pozycje zamówienia na karcie zamówienia: dodawanie (z katalogu albo spoza), zmiana i usuwanie,
  # oraz wyszukiwarka produktów do okna „Dodaj produkt”.
  class ItemsController < BaseController
    before_action :set_order

    # GET /orders/:order_id/items/products?q=… (JSON) - produkty sprzedawalne z ceną w grupie cenowej zamówienia
    # i liczbą dostępnych sztuk w magazynie zamówienia.
    def products
      price_group = Inventory.price_groups(Current.account).find_by(id: @order.price_group_id) || Inventory.default_price_group(Current.account)
      products = Inventory.search_sellable(Current.account, params[:q], price_group:)
      available = Inventory.available(Current.account, products.map(&:id), warehouse_id: @order.warehouse_id)
      render json: products.map { |product|
        { id: product.id, name: product.name, sku: product.sku, tax_rate: product.tax_rate.to_i,
          price: product.price_cents && Orders.format_money(product.price_cents, @order.currency),
          priceInput: Inventory.format_money_input(product.price_cents), available: available[product.id] }
      }
    end

    # POST /orders/:order_id/items  product_id=…&quantity=…&unit_price=… albo name=…&sku=…&quantity=…&unit_price=…&tax_rate=…
    def create
      Orders.add_item!(@order, item_params.merge(product_id: params[:product_id].presence))
      redirect_back_or_to order_path(@order), notice: "Dodano pozycję."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    # PATCH /orders/:order_id/items/:id  quantity=…&unit_price=… (+ name, sku, tax_rate dla pozycji spoza katalogu)
    def update
      Orders.update_item!(@order, params[:id], item_params)
      redirect_back_or_to order_path(@order), notice: "Zapisano pozycję."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), inertia: { errors: e.errors }
    end

    def destroy
      Orders.remove_item!(@order, params[:id])
      redirect_back_or_to order_path(@order), notice: "Usunięto pozycję."
    rescue InvalidData => e
      redirect_back_or_to order_path(@order), alert: e.message
    end

    private
      def set_order
        @order = Order.where(account: Current.account).includes(:items).find(params[:order_id])
      end

      # Pola formularza → atrybuty pozycji. Pusta cena przy produkcie z katalogu = cena z grupy cenowej.
      def item_params
        attrs = {}
        attrs[:quantity] = Integer(params[:quantity], exception: false) if params.key?(:quantity)
        if params.key?(:unit_price) && !(params[:unit_price].blank? && params[:product_id].present?)
          attrs[:unit_price_cents] = Inventory.parse_money(params[:unit_price])
        end
        attrs[:name] = params[:name].to_s.strip if params.key?(:name)
        attrs[:sku] = params[:sku].to_s.strip if params.key?(:sku)
        attrs[:tax_rate] = Float(params[:tax_rate].to_s.tr(",", "."), exception: false) if params.key?(:tax_rate)
        attrs
      end
  end
end
