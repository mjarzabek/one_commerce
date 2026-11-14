module Orders
  # Pole dodatkowe zamówienia zdefiniowane przez konto (Zamówienia › Ustawienia › Pola dodatkowe), np. „Priorytet”
  # (lista), „Prezent” (tak/nie). Wartości są w `orders_orders.custom_fields` pod kluczem id pola.
  # Typu nie zmieniamy po utworzeniu - zapisane wartości mogłyby przestać mu odpowiadać.
  class CustomField < ApplicationRecord
    KINDS = { "text" => "Tekst", "number" => "Liczba", "select" => "Lista", "date" => "Data", "boolean" => "Tak / nie" }.freeze

    belongs_to :account

    validates :name, presence: true, uniqueness: { scope: :account_id }
    validates :kind, inclusion: { in: KINDS.keys }
    validate :options_for_select
    validate :kind_unchanged, on: :update

    scope :ordered, -> { order(:position, :id) }

    before_validation :normalize_options
    before_create { self.position = (CustomField.where(account_id:).maximum(:position) || -1) + 1 }
    # Usunięte pole znika też z zamówień.
    after_destroy { Order.where(account_id:).where("custom_fields ? :key", key: id.to_s).update_all([ "custom_fields = custom_fields - ?", id.to_s ]) }

    # Wartość z formularza w postaci do zapisu: [wartość, nil] albo [nil, komunikat błędu]. Pusta wartość → [nil, nil].
    #   text    - tekst bez spacji na brzegach
    #   number  - liczba („12,5” → "12.5")
    #   select  - jedna z `options`
    #   date    - "RRRR-MM-DD"
    #   boolean - true / false (pusta = brak wartości)
    def cast(raw)
      value = raw.is_a?(String) ? raw.strip : raw
      return [ nil, nil ] if value.nil? || value == ""

      case kind
      when "text" then [ value.to_s, nil ]
      when "number"
        number = BigDecimal(value.to_s.gsub(/[[:space:]]/, "").tr(",", "."), exception: false)
        number ? [ number.to_s("F").delete_suffix(".0"), nil ] : [ nil, "Podaj liczbę" ]
      when "select" then options.include?(value) ? [ value, nil ] : [ nil, "Wybierz wartość z listy" ]
      when "date"
        date = Date.iso8601(value.to_s) rescue nil
        date ? [ date.iso8601, nil ] : [ nil, "Podaj datę" ]
      when "boolean" then [ ActiveModel::Type::Boolean.new.cast(value), nil ]
      end
    end

    private
      def normalize_options
        self.options = kind == "select" ? Array(options).map { _1.to_s.strip }.compact_blank.uniq : []
      end

      def options_for_select
        errors.add(:options, "Podaj co najmniej jedną wartość listy") if kind == "select" && options.empty?
      end

      def kind_unchanged
        errors.add(:kind, "Nie można zmienić typu pola") if kind_changed?
      end
  end
end
