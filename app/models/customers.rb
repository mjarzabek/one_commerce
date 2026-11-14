# Publiczne API klientów.
module Customers
  def self.table_name_prefix = "customers_"

  CHANNELS = Identity::CHANNELS

  module_function

  # Znajduje klienta po tożsamości w kanale albo tworzy nowego. Uzupełnia brakujące dane kontaktowe.
  #
  #   Customers.find_or_create_by_identity!(account, channel: "facebook", external_id: "1234",
  #     handle: "Anna Kowalska", attrs: { name: "Anna Kowalska" })
  def find_or_create_by_identity!(account, channel:, external_id:, handle: nil, attrs: {})
    attrs = attrs.to_h.symbolize_keys.slice(:name, :email, :phone, :default_address)

    Customer.transaction(requires_new: true) do
      identity = Identity.find_by(account:, channel: channel.to_s, external_id: external_id.to_s)
      return fill_in!(identity.customer, attrs) if identity

      customer = Customer.new(account:, **attrs)
      customer.identities.build(account:, channel: channel.to_s, external_id: external_id.to_s, handle:)
      customer.save!
      customer
    end
  rescue ActiveRecord::RecordNotUnique
    # Równoległe utworzenie tej samej tożsamości - bierzemy rekord, który wygrał.
    Identity.find_by!(account:, channel: channel.to_s, external_id: external_id.to_s).customer
  end

  # Klient bez tożsamości w kanale (zamówienie ręczne) - dopasowanie po e-mailu, jeśli jest.
  def find_or_create!(account, attrs)
    attrs = attrs.to_h.symbolize_keys.slice(:name, :email, :phone, :default_address)
    email = attrs[:email].to_s.strip.downcase.presence
    existing = email && Customer.find_by(account:, email:)
    existing ? fill_in!(existing, attrs) : Customer.create!(account:, **attrs)
  end

  def list(account)
    Customer.where(account:).includes(:identities).order(:id)
  end

  def find(account, id)
    list(account).find(id)
  end

  def fill_in!(customer, attrs)
    missing = attrs.select { |key, value| value.present? && customer[key].blank? }
    customer.update!(missing) if missing.any?
    customer
  end
  private_class_method :fill_in!
end
