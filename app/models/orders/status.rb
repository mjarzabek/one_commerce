module Orders
  # Status zamówienia zdefiniowany przez konto (Ustawienia zamówień › Statusy). Sam status niczego nie zmienia
  # w magazynie - skutki (zdjęcie ze stanu, paczka, faktura) będą podpinane automatyzacjami.
  # Dokładnie jeden status konta jest domyślny - dostają go nowe zamówienia.
  class Status < ApplicationRecord
    COLORS = %w[gray blue sky violet pink green amber orange red].freeze

    belongs_to :account
    belongs_to :status_group, optional: true, inverse_of: :statuses
    has_many :orders, inverse_of: :status

    validates :name, presence: true, uniqueness: { scope: :account_id }
    validates :color, inclusion: { in: COLORS }
    validate :status_group_from_account

    scope :ordered, -> { order(:position, :id) }

    before_create { self.position = (Status.where(account_id:).maximum(:position) || -1) + 1 }
    before_destroy :ensure_unused, prepend: true

    def make_default!
      transaction do
        Status.where(account_id:).where.not(id:).update_all(default: false)
        update!(default: true)
      end
    end

    private
      def status_group_from_account
        errors.add(:status_group, "nie należy do konta") if status_group && status_group.account_id != account_id
      end

      def ensure_unused
        if default?
          errors.add(:base, "Nie można usunąć statusu domyślnego - najpierw ustaw inny jako domyślny.")
        elsif orders.exists?
          errors.add(:base, "Nie można usunąć statusu, który mają zamówienia - najpierw przenieś je do innego statusu.")
        end
        throw :abort if errors.any?
      end
  end
end
