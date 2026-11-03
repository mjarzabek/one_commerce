module Inventory
  # Warianty produktu: dodawanie, edycja (SKU, EAN, ceny) i stany na karcie wariantu.
  class VariantsController < BaseController
    before_action :set_parent, only: %i[new create]
    before_action :set_variant, only: %i[edit update destroy]

    def new
      variant = @parent.variants.build(account: Current.account, catalog_id: @parent.catalog_id)
      render inertia: "core/inventory/variants/new", props: form_props(variant)
    end

    def create
      variant = @parent.variants.build(account: Current.account, catalog_id: @parent.catalog_id, position: @parent.variants.count)
      variant.assign_attributes(variant_params)
      if variant.save
        redirect_to edit_inventory_variant_path(variant, tab: "stock"), notice: "Dodano wariant „#{variant.name}”. Uzupełnij stan."
      else
        redirect_with_errors(variant, to: new_inventory_product_variant_path(@parent, tab: params[:tab].presence))
      end
    end

    def edit
      render inertia: "core/inventory/variants/edit", props: form_props(@variant).merge(stock: stock_json(@variant))
    end

    def update
      if @variant.update(variant_params)
        redirect_to edit_inventory_variant_path(@variant, tab: params[:tab].presence), notice: "Zapisano wariant."
      else
        redirect_with_errors(@variant, to: edit_inventory_variant_path(@variant, tab: params[:tab].presence))
      end
    end

    def destroy
      parent = @variant.parent
      @variant.destroy!
      redirect_to edit_inventory_product_path(parent, tab: "variants"), notice: "Usunięto wariant „#{@variant.name}”."
    rescue ActiveRecord::InvalidForeignKey
      redirect_to edit_inventory_variant_path(@variant),
        alert: "Nie można usunąć wariantu, który ma historię magazynową lub zamówienia - zarchiwizuj produkt."
    end

    private
      def set_parent
        @parent = Product.main.where(account: Current.account).find(params[:product_id])
      end

      def set_variant
        @variant = Product.where(account: Current.account).where.not(parent_id: nil).includes(:prices, :parent).find(params[:id])
      end

      def variant_params
        permitted = params.expect(variant: [ :name, :sku, :ean, price_inputs: {} ])
        permitted[:price_inputs] = catalog_price_inputs(permitted[:price_inputs], (@variant || @parent).catalog) if permitted.key?(:price_inputs)
        permitted
      end

      def form_props(variant)
        parent = variant.parent
        {
          variant: { id: variant.id, name: variant.name.to_s, sku: variant.sku.to_s, ean: variant.ean.to_s, prices: price_inputs_json(variant) },
          parent: { id: parent.id, name: parent.name, sku: parent.sku },
          catalog: { id: parent.catalog.id, name: parent.catalog.name },
          priceGroups: price_groups_json(parent.catalog)
        }
      end
  end
end
