module Inventory
  # Kategoria produktów. Drzewo przez kategorię nadrzędną (`parent`).
  #
  # - Ogólna (bez katalogu) - do wyboru w produktach każdego katalogu.
  # - Katalogu - tylko w produktach tego katalogu. Jej nadrzędna może być ogólna albo z tego samego katalogu;
  #   ogólna nie może mieć nadrzędnej z katalogu.
  # - Źródło: „manual” (utworzona ręcznie) albo marketplace (np. „allegro”) - wtedy `external_id` to id kategorii
  #   w marketplace (import aktualizuje istniejące kategorie po tym id, `Inventory.import_categories!`).
  #
  # Usunięcie kategorii zdejmuje ją z produktów (bez kategorii); kategorii z podkategoriami nie można usunąć.
  class Category < ApplicationRecord
    MANUAL = "manual".freeze

    belongs_to :account
    belongs_to :catalog, optional: true
    belongs_to :parent, class_name: "Category", optional: true, inverse_of: :children
    has_many :children, class_name: "Category", foreign_key: :parent_id, dependent: :restrict_with_error, inverse_of: :parent
    has_many :products, dependent: :nullify

    normalizes :name, with: ->(value) { value.squish }
    normalizes :external_id, with: ->(value) { value.to_s.strip.presence }

    validates :name, presence: true, uniqueness: { scope: %i[account_id catalog_id parent_id], case_sensitive: false }
    validates :source, presence: true
    validate :same_account
    validate :parent_allowed
    validate :catalog_change_allowed, on: :update

    # Kategorie do wyboru w produktach katalogu: ogólne i tego katalogu.
    scope :for_catalog, ->(catalog_id) { where(catalog_id: [ nil, catalog_id ]) }

    def general? = catalog_id.nil?
    def manual? = source == MANUAL

    # Pełna ścieżka „Odzież › Sukienki › Letnie”. `index` - kategorie konta po id (bez dodatkowych zapytań).
    def path(index = nil)
      names = []
      node = self
      seen = Set.new
      while node && seen.add?(node.id || node.object_id)
        names.unshift(node.name)
        node = index ? index[node.parent_id] : node.parent
      end
      names.join(" › ")
    end

    # Czy `other` leży w poddrzewie tej kategorii (albo jest nią samą).
    def ancestor_of?(other)
      node = other
      while node
        return true if node.id == id

        node = node.parent
      end
      false
    end

    private
      def same_account
        errors.add(:catalog, "nie należy do konta") if catalog && catalog.account_id != account_id
        errors.add(:parent, "nie należy do konta") if parent && parent.account_id != account_id
      end

      def parent_allowed
        return unless parent

        if persisted? && ancestor_of?(parent)
          errors.add(:parent_id, "Kategoria nie może być nadrzędną samej siebie ani swojej podkategorii")
        elsif !parent.general? && parent.catalog_id != catalog_id
          errors.add(:parent_id, general? ? "Kategoria ogólna może mieć tylko ogólną kategorię nadrzędną" :
                                            "Kategoria nadrzędna musi być ogólna albo z tego samego katalogu")
        end
      end

      # Przejście do katalogu: podkategorie i produkty muszą pasować do nowego katalogu.
      def catalog_change_allowed
        return unless will_save_change_to_catalog_id? && catalog_id

        if children.where.not(catalog_id:).exists?
          errors.add(:catalog_id, "Kategoria ma podkategorie ogólne albo z innego katalogu")
        elsif products.where.not(catalog_id:).exists?
          errors.add(:catalog_id, "Kategorię mają produkty z innego katalogu")
        end
      end
  end
end
