module Chat
  # Wszystkie ekrany modułu wymagają aktywnej licencji.
  class BaseController < InertiaController
    requires_module :chat
  end
end
