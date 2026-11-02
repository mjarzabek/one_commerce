class CreateCustomers < ActiveRecord::Migration[8.1]
  def change
    create_table :customers_customers do |t|
      t.references :account, null: false, foreign_key: true
      t.string :name
      t.string :email
      t.string :phone
      t.jsonb :default_address, null: false, default: {}
      t.text :notes
      t.timestamps
    end
    add_index :customers_customers, %i[account_id email]

    create_table :customers_identities do |t|
      t.references :account, null: false, foreign_key: true
      t.references :customer, null: false, foreign_key: { to_table: :customers_customers }
      t.string :channel, null: false
      t.string :external_id, null: false
      t.string :handle
      t.timestamps
    end
    add_index :customers_identities, %i[account_id channel external_id], unique: true
  end
end
