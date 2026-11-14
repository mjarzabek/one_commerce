module Api
  module V1
    # GET /api/v1/products - produkty (proste i wariantowe z wariantami) z cenami i stanami (?catalog_id=, ?cursor=, ?limit=).
    # Warianty mają VAT, opis i parametry już z dziedziczeniem z produktu głównego.
    class ProductsController < BaseController
      before_action -> { require_scope!("catalog:read") }
      before_action :require_orders_panel!

      def index
        catalog = Inventory.catalogs(Current.account).find(params[:catalog_id]) if params[:catalog_id].present?
        products, next_cursor = paginate(Inventory.products(Current.account, catalog:))
        render json: { data: products_json(products), meta: { next_cursor: } }
      end

      def show
        product = Inventory.find_product(Current.account, params[:id])
        render json: { data: products_json([ product ]).first }
      end

      private
        def products_json(products)
          ids = products.flat_map { [ _1.id, *_1.variants.map(&:id) ] }
          @available = Inventory.available(Current.account, ids)
          @levels = Inventory.stock_levels(Current.account, ids)
          @groups = Inventory.price_groups(Current.account).index_by(&:id)

          products.map do |product|
            product_json(product).merge(variants: product.variants.map { product_json(_1) })
          end
        end

        def product_json(product)
          {
            id: product.id, catalog_id: product.catalog_id, parent_id: product.parent_id,
            name: product.name, sku: product.sku, ean: product.ean, status: product.status,
            # Wariant: wartości z dziedziczeniem z produktu głównego (własne albo produktu).
            tax_rate: product.effective_tax_rate, description: product.effective(:description),
            manufacturer: product.effective(:manufacturer), category_id: product.effective(:category_id),
            parameters: product.effective_parameters,
            prices: product.prices.map do |price|
              group = @groups.fetch(price.price_group_id)
              { price_group_id: group.id, price_group: group.name, amount_cents: price.amount_cents, currency: group.currency }
            end,
            available: @available.fetch(product.id),
            stock: @levels.fetch(product.id, {}).values.map do |item|
              { warehouse_id: item.warehouse_id, on_hand: item.on_hand, reserved: item.reserved, available: item.available }
            end
          }
        end
    end
  end
end
