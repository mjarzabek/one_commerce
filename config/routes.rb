Rails.application.routes.draw do
  # Health check dla load balancera i Kamal.
  get "up" => "rails/health#show", as: :rails_health_check

  # Trasy pakietów: packs/**/config/routes/*.rb
  draw :panel         # logowanie, pulpit (Core)
  draw :orders        # panel obsługi zamówień (Core, przy Live lub MultiChannel)
  draw :inventory     # magazyn: produkty, katalogi, stany, ceny (Core)
  draw :live          # [Nazwa] Live
  draw :multichannel  # [Nazwa] MultiChannel
  draw :chat          # [Nazwa] Chat
  draw :api           # publiczne REST API /api/v1
end
