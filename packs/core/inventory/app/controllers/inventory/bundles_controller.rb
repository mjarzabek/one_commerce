module Inventory
  # Zakładka „Zestawy” listy produktów - na razie zapowiedź, zestawy jeszcze nie istnieją.
  class BundlesController < BaseController
    def index
      render inertia: "core/inventory/bundles/index"
    end
  end
end
