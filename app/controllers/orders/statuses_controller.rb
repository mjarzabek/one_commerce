module Orders
  # Ustawienia zamówień › Statusy: własne statusy konta w grupach, kolejność, kolor i status domyślny.
  class StatusesController < BaseController
    before_action :set_status, only: %i[update destroy default]

    def index
      counts = Order.where(account: Current.account).group(:status_id).count
      render inertia: "core/orders/settings/statuses", props: { tree: status_tree(counts:), colors: Status::COLORS }
    end

    def create
      status = Status.new(account: Current.account, **status_params)
      if status.save
        redirect_to orders_settings_statuses_path, notice: "Dodano status „#{status.name}”."
      else
        redirect_with_errors(status, to: orders_settings_statuses_path)
      end
    end

    def update
      group_changed = status_params[:status_group]&.id != @status.status_group_id
      if @status.update(status_params)
        # Po przeniesieniu do innej grupy status trafia na jej koniec.
        @status.update_column(:position, Status.where(account: Current.account).maximum(:position).to_i + 1) if group_changed
        redirect_to orders_settings_statuses_path, notice: "Zapisano status."
      else
        redirect_with_errors(@status, to: orders_settings_statuses_path)
      end
    end

    def destroy
      if @status.destroy
        redirect_to orders_settings_statuses_path, notice: "Usunięto status „#{@status.name}”."
      else
        redirect_to orders_settings_statuses_path, alert: @status.errors.full_messages.to_sentence
      end
    end

    # PATCH /orders/settings/statuses/reorder - kolejność po przeciągnięciu: grup (`groups` - id) i statusów w grupach
    # (`sections` - [{ status_group_id:, statuses: [id] }], status_group_id pusty = bez grupy). Status przeciągnięty do innej grupy
    # zmienia grupę.
    def reorder
      groups = StatusGroup.where(account: Current.account)
      statuses = Status.where(account: Current.account)
      Status.transaction do
        apply_order(groups, params[:groups])
        Array(params[:sections]).reduce(0) do |position, section|
          status_group_id = groups.find_by(id: section[:status_group_id].presence)&.id
          next position if section[:status_group_id].present? && !status_group_id

          apply_order(statuses, section[:statuses], start: position, status_group_id:)
        end
      end
      redirect_to orders_settings_statuses_path
    end

    # PATCH /orders/settings/statuses/:id/default - status nowych zamówień.
    def default
      @status.make_default!
      redirect_to orders_settings_statuses_path, notice: "Nowe zamówienia dostaną status „#{@status.name}”."
    end

    private
      def set_status
        @status = Status.where(account: Current.account).find(params[:id])
      end

      def status_params
        @status_params ||= {
          name: params[:name].to_s.strip,
          color: params[:color].presence || "gray",
          status_group: params[:status_group_id].present? ? StatusGroup.where(account: Current.account).find(params[:status_group_id]) : nil
        }
      end
  end
end
