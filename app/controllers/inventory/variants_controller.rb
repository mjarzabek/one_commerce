module Inventory
  # Karta wariantu - pełnoprawnego produktu z tymi samymi polami co produkt (dane, zdjęcia, opisy, parametry, wymiary,
  # VAT, ceny, stan) oraz historią i rezerwacjami. Puste pola dziedziczą wartości produktu głównego.
  class VariantsController < BaseController
    before_action :set_parent, only: %i[new create]
    before_action :set_variant, only: %i[edit update destroy]

    # Ceny nowego wariantu podpowiadamy z ostatniego wariantu (pierwszy wariant - z cen produktu).
    # Wszystkie pola z dziedziczeniem zaczynają puste - wariant bierze je z produktu głównego.
    def new
      prices_from = @parent.variants.last || @parent
      variant = @parent.variants.build(account: Current.account, catalog_id: @parent.catalog_id)
      render inertia: "core/inventory/variants/new", props: form_props(variant, prices_from:)
    end

    def create
      variant = @parent.variants.build(account: Current.account, catalog_id: @parent.catalog_id, position: @parent.variants.count)
      variant.assign_attributes(variant_params)
      if variant.save
        redirect_to edit_inventory_variant_path(variant, tab: "sales"), notice: "Dodano wariant. Uzupełnij jego stan."
      else
        redirect_with_errors(variant, to: new_inventory_product_variant_path(@parent, tab: params[:tab].presence))
      end
    end

    def edit
      render inertia: "core/inventory/variants/edit", props: form_props(@variant).merge(
        images: images_json(@variant), stock: stock_json(@variant), activity: activity_json(@variant),
        reservationsEnabled: reservations_enabled?, siblings: @variant.parent.variants.map { { id: _1.id, name: _1.name } }
      )
    end

    # PATCH /inventory/variants/:id  variant[…] (dane, ceny) i stock[<warehouse_id>]=<na stanie> - zapisywane razem.
    def update
      @variant.assign_attributes(variant_params)
      stock_errors = {}
      Product.transaction do
        raise ActiveRecord::Rollback unless @variant.save

        stock_errors = apply_stock(@variant, params[:stock])
        raise ActiveRecord::Rollback if stock_errors.any?
      end

      target = edit_inventory_variant_path(@variant, tab: params[:tab].presence)
      if @variant.errors.none? && stock_errors.none?
        redirect_to target, notice: "Zapisano wariant."
      else
        redirect_to target, inertia: { errors: inertia_errors(@variant).merge(stock_errors) }
      end
    end

    def destroy
      parent = @variant.parent
      @variant.destroy!
      redirect_to edit_inventory_product_path(parent, tab: "variants"), notice: "Usunięto wariant „#{@variant.name}”."
    end

    private
      def set_parent
        @parent = Product.main.where(account: Current.account).find(params[:product_id])
      end

      def set_variant
        @variant = Product.where(account: Current.account).where.not(parent_id: nil)
          .includes(:prices, parent: [ :catalog, { images: { file_attachment: :blob } }, :variants ]).find(params[:id])
      end

      # Pusty VAT (""), opis (null) i wymiar ("") = dziedziczenie z produktu głównego.
      def variant_params
        permitted = params.expect(variant: CARD_PARAMS)
        permitted[:price_inputs] = catalog_price_inputs(permitted[:price_inputs], (@variant || @parent).catalog) if permitted.key?(:price_inputs)
        permitted
      end

      def form_props(variant, prices_from: variant)
        parent = variant.parent
        {
          variant: card_json(variant).merge(prices: price_inputs_json(prices_from)),
          parent: { id: parent.id, name: parent.name, sku: parent.sku },
          inherited: inherited_json(parent),
          catalog: { id: parent.catalog.id, name: parent.catalog.name },
          categories: categories_json(parent.catalog),
          priceGroups: price_groups_json(parent.catalog),
          statuses: Product::STATUS_LABELS,
          taxRates: Product::TAX_RATES.map(&:to_s)
        }
      end
  end
end
