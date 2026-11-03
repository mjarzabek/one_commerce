# Karta produktu: opisy dodatkowe (np. do Allegro i sklepów), parametry (nazwa - wartość) i wymiary paczki.
class AddContentToInventoryProducts < ActiveRecord::Migration[8.1]
  def change
    change_table :inventory_products, bulk: true do |t|
      t.text :description_extra_1
      t.text :description_extra_2
      t.text :description_extra_3
      t.jsonb :parameters, default: [], null: false
      t.integer :length_mm
      t.integer :width_mm
      t.integer :height_mm
    end
  end
end
