module Inventory
  # Ręczne zamykanie aktywnych rezerwacji z karty produktu: zwolnienie albo realizacja (wydanie z magazynu).
  # Zamówienia są na to odporne - przy wysyłce zdejmują tylko to, czego jeszcze nie zdjęto.
  class ReservationsController < BaseController
    before_action :set_reservation

    def release
      Inventory.release_reservation!(Current.account, @reservation.id)
      redirect_back_or_to inventory_root_path, notice: "Zwolniono #{@reservation.quantity} szt. - #{label}. Towar wrócił do dostępnych."
    end

    def fulfill
      Inventory.fulfill_reservation!(Current.account, @reservation.id, user: Current.user)
      redirect_back_or_to inventory_root_path, notice: "Zrealizowano #{@reservation.quantity} szt. - #{label}. Towar zszedł ze stanu."
    end

    private
      def set_reservation
        @reservation = Reservation.where(account: Current.account).active.find(params[:id])
      end

      def label = @reservation.holder_label || "rezerwacja #{@reservation.id}"
  end
end
