module Multichannel
  # Wszystkie ekrany modułu wymagają aktywnej licencji.
  class BaseController < InertiaController
    requires_module :multichannel
  end
end
