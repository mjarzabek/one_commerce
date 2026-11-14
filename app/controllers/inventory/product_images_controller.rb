module Inventory
  # Zdjęcia na karcie produktu albo wariantu: dodawanie (kilka naraz), zmiana kolejności (pierwsze = główne) i usuwanie.
  # Zapisują się od razu, bez paska zapisu formularza. Wariant pokazuje swoje zdjęcia, a po nich zdjęcia produktu głównego.
  class ProductImagesController < BaseController
    # POST /inventory/products/:product_id/images  images[]=<plik>…
    def create
      product = Product.where(account: Current.account).find(params[:product_id])
      files = Array(params[:images]).select { _1.respond_to?(:content_type) }
      free = ProductImage::LIMIT - product.images.count
      return back_to(product, alert: "Wybierz zdjęcia do dodania.") if files.empty?
      return back_to(product, alert: "Produkt może mieć najwyżej #{ProductImage::LIMIT} zdjęć.") if files.size > free

      position = product.images.maximum(:position).to_i
      errors = []
      files.each do |file|
        image = product.images.build(account: Current.account, position: position += 1, file:)
        next if image.save

        errors << "#{file.original_filename}: #{image.errors.full_messages.to_sentence}"
        product.images.delete(image)
      end

      added = files.size - errors.size
      return back_to(product, alert: errors.join(" ")) if added.zero?

      back_to(product, **(errors.any? ? { warning: "Dodano #{added} z #{files.size}. #{errors.join(' ')}" } : { notice: "Dodano zdjęcia." }))
    end

    # PATCH /inventory/images/:id  position=<0…> - nowe miejsce zdjęcia (0 = zdjęcie główne).
    def update
      image = find_image
      ordered = image.product.images.to_a
      ordered.delete(image)
      ordered.insert(params[:position].to_i.clamp(0, ordered.size), image)
      ProductImage.transaction { ordered.each_with_index { |item, index| item.update_column(:position, index) } }
      back_to(image.product, notice: "Zmieniono kolejność zdjęć.")
    end

    def destroy
      image = find_image
      image.destroy!
      back_to(image.product, notice: "Usunięto zdjęcie.")
    end

    private
      def find_image
        ProductImage.where(account: Current.account).includes(:product).find(params[:id])
      end

      def back_to(product, **flash)
        redirect_to product.variant? ? edit_inventory_variant_path(product) : edit_inventory_product_path(product), **flash
      end
  end
end
