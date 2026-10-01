class CreateModuleLicenses < ActiveRecord::Migration[8.1]
  def change
    create_table :module_licenses do |t|
      t.references :account, null: false, foreign_key: true
      t.string :module_key, null: false
      t.string :status, null: false, default: "trialing"
      t.string :plan, null: false, default: "standard"
      t.jsonb :limits, null: false, default: {}
      t.datetime :trial_ends_at
      t.datetime :current_period_ends_at
      t.timestamps
    end
    add_index :module_licenses, %i[account_id module_key], unique: true
  end
end
