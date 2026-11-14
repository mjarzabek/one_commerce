module Inventory
  # Zdjęcie produktu. Kolejność według `position`; pierwsze jest zdjęciem głównym.
  class ProductImage < ApplicationRecord
    CONTENT_TYPES = %w[image/jpeg image/png image/webp image/gif].freeze
    MAX_SIZE = 10.megabytes
    LIMIT = 16

    belongs_to :account
    belongs_to :product, inverse_of: :images
    # Miniatura na liście produktów (36 px, dwukrotnie dla ekranów o dużej gęstości).
    has_one_attached :file do |attachable|
      attachable.variant :thumb, resize_to_fill: [ 72, 72 ]
    end

    before_validation { self.account ||= product&.account }

    validate :file_is_image

    private
      def file_is_image
        return errors.add(:file, "jest wymagany") unless file.attached?

        errors.add(:file, "musi być zdjęciem (JPG, PNG, WEBP lub GIF)") unless file.content_type.in?(CONTENT_TYPES)
        errors.add(:file, "jest za duży - maksymalnie 10 MB") if file.byte_size > MAX_SIZE
      end
  end
end
