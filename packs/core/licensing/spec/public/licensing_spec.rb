require "rails_helper"

RSpec.describe Licensing do
  let(:account) { create(:account) }

  it "nie daje dostępu bez licencji" do
    expect(described_class.enabled?(account, :live)).to be(false)
    expect(described_class.orders_panel?(account)).to be(false)
  end

  it "włącza moduł i panel zamówień dla Live" do
    described_class.grant!(account, :live)

    expect(described_class.enabled?(account, :live)).to be(true)
    expect(described_class.orders_panel?(account)).to be(true)
  end

  it "nie włącza panelu zamówień dla samego Chatu" do
    described_class.grant!(account, :chat)

    expect(described_class.enabled_modules(account)).to eq([ :chat ])
    expect(described_class.orders_panel?(account)).to be(false)
  end

  it "pakiet ONE włącza wszystkie moduły" do
    described_class.grant_bundle!(account, :one)

    expect(described_class.enabled_modules(account)).to eq(%i[live multichannel chat])
    expect(described_class.summary(account)).to include(bundle: "one", ordersPanel: true)
  end

  it "wyłącza moduł po końcu okresu próbnego" do
    described_class.grant!(account, :live, trial_days: 14)
    expect(described_class.enabled?(account, :live)).to be(true)

    travel 15.days do
      expect(described_class.enabled?(account, :live)).to be(false)
    end
  end

  it "odrzuca nieznany moduł" do
    expect { described_class.enabled?(account, :crm) }.to raise_error(Licensing::UnknownModule)
  end
end
