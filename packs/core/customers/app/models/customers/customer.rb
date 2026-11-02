module Customers
  # Klient konta. Jedna osoba może mieć wiele tożsamości w kanałach (FB, IG, Allegro, e-mail).
  class Customer < ApplicationRecord
    belongs_to :account
    has_many :identities, dependent: :destroy, inverse_of: :customer

    normalizes :email, with: ->(email) { email.strip.downcase.presence }
    normalizes :phone, with: ->(phone) { phone.gsub(/[^\d+]/, "").presence }

    validate :name_or_contact_present

    def display_name
      name.presence || email.presence || identities.first&.handle || "Klient ##{id}"
    end

    private
      def name_or_contact_present
        return if name.present? || email.present? || phone.present? || identities.any?

        errors.add(:base, "Klient musi mieć nazwę, e-mail, telefon lub tożsamość w kanale")
      end
  end
end
