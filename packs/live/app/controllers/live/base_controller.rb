module Live
  # Wszystkie ekrany modułu wymagają aktywnej licencji.
  class BaseController < InertiaController
    requires_module :live
  end
end
