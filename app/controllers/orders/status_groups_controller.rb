module Orders
  # Ustawienia zamówień › Statusy: grupy statusów (jeden poziom). Usunięcie grupy zostawia jej statusy bez grupy.
  class StatusGroupsController < BaseController
    before_action :set_group, only: %i[update destroy]

    def create
      group = StatusGroup.new(account: Current.account, name: params[:name].to_s.strip)
      if group.save
        redirect_to orders_settings_statuses_path, notice: "Dodano grupę „#{group.name}”."
      else
        redirect_with_errors(group, to: orders_settings_statuses_path)
      end
    end

    def update
      if @group.update(name: params[:name].to_s.strip)
        redirect_to orders_settings_statuses_path, notice: "Zapisano grupę."
      else
        redirect_with_errors(@group, to: orders_settings_statuses_path)
      end
    end

    def destroy
      @group.destroy!
      redirect_to orders_settings_statuses_path, notice: "Usunięto grupę „#{@group.name}”."
    end

    private
      def set_group
        @group = StatusGroup.where(account: Current.account).find(params[:id])
      end
  end
end
