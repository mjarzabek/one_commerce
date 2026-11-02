module Orders
  # Zamówienie z dowolnego źródła. Dane klienta i pozycji są migawką z chwili złożenia.
  class Order < ApplicationRecord
    TRANSITIONS = {
      "new" => %w[confirmed paid processing cancelled],
      "confirmed" => %w[paid processing cancelled],
      "paid" => %w[processing shipped cancelled],
      "processing" => %w[shipped cancelled],
      "shipped" => %w[delivered returned],
      "delivered" => %w[returned],
      "cancelled" => [],
      "returned" => []
    }.freeze

    belongs_to :account
    has_many :items, -> { order(:id) }, dependent: :destroy, inverse_of: :order
    has_many :status_changes, -> { order(:id) }, dependent: :destroy, inverse_of: :order

    enum :source, { live: "live", multichannel: "multichannel", manual: "manual", api: "api" },
      validate: true, prefix: :from
    # Bez scope'ów: status „new” dałby metodę klasy `Order.new`.
    enum :status, TRANSITIONS.keys.index_by(&:itself), default: :new, validate: true, scopes: false
    enum :payment_status, { unpaid: "unpaid", paid: "paid", refunded: "refunded" },
      default: :unpaid, validate: true, prefix: :payment

    validates :number, presence: true, uniqueness: { scope: :account_id }
    validates :external_id, uniqueness: { scope: %i[account_id source] }, allow_nil: true
    validates :currency, :placed_at, presence: true

    # Opis zamówienia w rezerwacjach i historii ruchów Inventory.
    def inventory_label = "Zamówienie #{number}"

    def can_transition_to?(status)
      TRANSITIONS.fetch(self.status).include?(status.to_s)
    end

    def recalculate_totals
      self.subtotal_cents = items.sum(&:calculate_total)
      self.total_cents = subtotal_cents + shipping_cents.to_i
    end
  end
end
