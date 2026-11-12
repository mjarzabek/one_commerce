module Orders
  # Wspólna baza ekranów panelu zamówień: dostęp z panelem zamówień i domyślne statusy konta.
  class BaseController < InertiaController
    requires_orders_panel
    before_action { Orders.ensure_setup!(Current.account) }

    private
      def redirect_with_errors(record, to: request.referer || orders_path)
        redirect_to to, inertia: { errors: inertia_errors(record) }
      end

      # Grupy ze statusami (w kolejności z ustawień) i statusy bez grupy - lista po lewej, selecty statusu, ustawienia.
      # `counts` - { status_id => liczba zamówień }.
      def status_tree(counts: nil)
        statuses = Status.where(account: Current.account).ordered.to_a
        status_json = lambda do |status|
          { id: status.id, name: status.name, color: status.color, default: status.default, group_id: status.group_id,
            count: counts&.fetch(status.id, 0) }.compact
        end
        {
          groups: StatusGroup.where(account: Current.account).ordered.map do |group|
            { id: group.id, name: group.name, statuses: statuses.select { _1.group_id == group.id }.map(&status_json) }
          end,
          ungrouped: statuses.reject(&:group_id).map(&status_json)
        }
      end

      # Kolejność po przeciągnięciu: `ids` w nowej kolejności (rekordy spoza `scope` są pomijane). `attrs` - dodatkowe
      # kolumny ustawiane razem z pozycją (np. grupa statusu). Pozycje od `start`; zwraca następną wolną.
      def apply_order(scope, ids, start: 0, **attrs)
        records = scope.where(id: ids).index_by(&:id)
        Array(ids).map(&:to_i).uniq.filter_map { records[_1] }.each.with_index(start) do |record, position|
          changes = { position:, **attrs }.reject { |key, value| record[key] == value }
          record.update_columns(changes) if changes.any?
        end
        start + records.size
      end
  end
end
