# Wariant to pełnoprawny produkt: może mieć własny VAT, opisy, parametry, wymiary i zdjęcia, a puste pole (NULL)
# dziedziczy wartość produktu głównego. Dotąd warianty zawsze brały VAT rodzica - zerujemy im stawkę, żeby dalej dziedziczyły.
class LetVariantsInheritProductFields < ActiveRecord::Migration[8.1]
  def up
    change_column_default :inventory_products, :tax_rate, from: 23, to: nil
    change_column_null :inventory_products, :tax_rate, true
    execute "UPDATE inventory_products SET tax_rate = NULL WHERE parent_id IS NOT NULL"
    execute "ALTER TABLE inventory_products ADD CONSTRAINT inventory_products_main_tax_rate " \
            "CHECK (parent_id IS NOT NULL OR tax_rate IS NOT NULL)"
  end

  def down
    execute "ALTER TABLE inventory_products DROP CONSTRAINT inventory_products_main_tax_rate"
    execute "UPDATE inventory_products v SET tax_rate = p.tax_rate FROM inventory_products p " \
            "WHERE v.parent_id = p.id AND v.tax_rate IS NULL"
    change_column_null :inventory_products, :tax_rate, false
    change_column_default :inventory_products, :tax_rate, from: nil, to: 23
  end
end
