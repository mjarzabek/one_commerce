module Orders
  # Zamówienie z dowolnego źródła. Dane klienta i pozycji są migawką z chwili złożenia.
  class Order < ApplicationRecord
    belongs_to :account
    belongs_to :status, class_name: "Orders::Status"
    has_many :items, -> { order(:id) }, dependent: :destroy, inverse_of: :order
    has_many :status_changes, -> { order(:id) }, dependent: :destroy, inverse_of: :order

    enum :source, { live: "live", multichannel: "multichannel", manual: "manual", api: "api" },
      validate: true, prefix: :from
    # Status płatności wynika z kwoty wpłaconej (`paid_cents`) i wartości zamówienia - liczony przy zapisie,
    # trzymany w kolumnie dla filtrów listy.
    enum :payment_status, { unpaid: "unpaid", partial: "partial", paid: "paid", overpaid: "overpaid" },
      default: :unpaid, validate: true, prefix: :payment
    enum :payment_method, { transfer: "transfer", online: "online", cod: "cod", cash: "cash" },
      validate: { allow_nil: true }, prefix: :paid_by

    validates :number, presence: true, uniqueness: { scope: :account_id }
    validates :external_id, uniqueness: { scope: %i[account_id source] }, allow_nil: true
    validates :currency, :placed_at, presence: true
    validates :paid_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

    before_save { self.payment_status = derived_payment_status }

    # Opis zamówienia w rezerwacjach i historii ruchów Inventory.
    def inventory_label = "Zamówienie #{number}"

    # Ile brakuje do pełnej kwoty (0 przy wpłacie pełnej lub nadpłacie).
    def remaining_cents = [ total_cents - paid_cents, 0 ].max

    def overpaid_cents = [ paid_cents - total_cents, 0 ].max

    # Za pobraniem i nic jeszcze nie wpłacono - klient zapłaci kurierowi.
    def cod_pending? = paid_by_cod? && paid_cents.zero?

    def recalculate_totals
      self.subtotal_cents = items.sum(&:calculate_total)
      self.total_cents = subtotal_cents + shipping_cents.to_i
    end

    private
      def derived_payment_status
        if paid_cents.to_i <= 0 then :unpaid
        elsif paid_cents < total_cents then :partial
        elsif paid_cents == total_cents then :paid
        else :overpaid
        end
      end
  end
end
