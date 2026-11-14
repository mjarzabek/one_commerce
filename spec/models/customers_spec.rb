require "rails_helper"

RSpec.describe Customers do
  let(:account) { create(:account) }

  it "nie dubluje klienta z tej samej tożsamości w kanale" do
    first = described_class.find_or_create_by_identity!(account, channel: "facebook", external_id: "123", handle: "anna.k")
    second = described_class.find_or_create_by_identity!(account, channel: "facebook", external_id: "123",
      attrs: { name: "Anna Kowalska", email: "Anna@Example.com " })

    expect(second).to eq(first)
    expect(second.reload).to have_attributes(name: "Anna Kowalska", email: "anna@example.com")
  end

  it "rozdziela tożsamości między kontami" do
    mine = described_class.find_or_create_by_identity!(account, channel: "allegro", external_id: "x")
    theirs = described_class.find_or_create_by_identity!(create(:account), channel: "allegro", external_id: "x")

    expect(mine).not_to eq(theirs)
  end

  it "dopasowuje klienta ręcznego po e-mailu" do
    first = described_class.find_or_create!(account, name: "Jan", email: "jan@example.com")

    expect(described_class.find_or_create!(account, email: "JAN@example.com", phone: "+48 600 100 200")).to eq(first)
    expect(first.reload.phone).to eq("+48600100200")
  end
end
