# Publiczne API licencjonowania. Jedyne miejsce, które odpowiada na pytanie
# „czy to konto ma dostęp do modułu X?” - w kontrolerach, jobach, webhookach i API.
module Licensing
  MODULES = %i[live multichannel chat].freeze
  BUNDLES = { one: MODULES }.freeze

  # Moduły, które tworzą zamówienia - przy nich klient dostaje panel obsługi zamówień.
  ORDER_SOURCES = %i[live multichannel].freeze

  TRIAL_DAYS = 14

  class UnknownModule < ArgumentError; end

  module_function

  def enabled?(account, mod)
    enabled_modules(account).include?(normalize(mod))
  end

  def enabled_modules(account)
    return [] unless account

    ModuleLicense.where(account:).usable.select(&:usable?).map { |l| l.module_key.to_sym }.sort_by { MODULES.index(_1) }
  end

  def orders_panel?(account)
    (enabled_modules(account) & ORDER_SOURCES).any?
  end

  def bundle?(account, bundle = :one)
    (BUNDLES.fetch(bundle) - enabled_modules(account)).empty?
  end

  def grant!(account, mod, status: :active, plan: "standard", trial_days: nil)
    license = ModuleLicense.find_or_initialize_by(account:, module_key: normalize(mod))
    license.update!(
      status: trial_days ? :trialing : status,
      plan:,
      trial_ends_at: trial_days&.days&.from_now
    )
    license
  end

  def grant_bundle!(account, bundle = :one, **options)
    BUNDLES.fetch(bundle).map { |mod| grant!(account, mod, plan: bundle.to_s, **options) }
  end

  def revoke!(account, mod)
    ModuleLicense.find_by(account:, module_key: normalize(mod))&.update!(status: :cancelled)
  end

  # Dane dla frontendu (wspólne propsy Inertia).
  def summary(account)
    enabled = enabled_modules(account)
    {
      enabled: enabled.map(&:to_s),
      ordersPanel: (enabled & ORDER_SOURCES).any?,
      bundle: (BUNDLES[:one] - enabled).empty? ? "one" : nil
    }
  end

  def normalize(mod)
    key = mod.to_sym
    raise UnknownModule, "Nieznany moduł: #{mod}" unless MODULES.include?(key)

    key
  end
end
