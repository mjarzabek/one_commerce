# Po załadowaniu schematu do nowej bazy licznik ID produktów startuje od 1 - ustawiamy go ponownie
# (patrz Inventory.ensure_product_id_start!).
namespace :db do
  task product_id_start: :environment do
    Inventory.ensure_product_id_start!
  end
end

%w[db:prepare db:schema:load db:setup db:reset].each do |name|
  Rake::Task[name].enhance { Rake::Task["db:product_id_start"].invoke } if Rake::Task.task_defined?(name)
end
