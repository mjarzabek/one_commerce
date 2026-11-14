class RenameGroupIdToStatusGroupIdOnOrdersStatuses < ActiveRecord::Migration[8.1]
  def change
    rename_column :orders_statuses, :group_id, :status_group_id
  end
end
