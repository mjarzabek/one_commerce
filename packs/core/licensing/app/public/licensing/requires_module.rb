# Bramka licencji dla kontrolerów panelu (Inertia).
#
#   class Live::BaseController < InertiaController
#     requires_module :live
#   end
#
# Bez licencji użytkownik zobaczy ekran z ofertą modułu zamiast błędu.
module Licensing
  module RequiresModule
    extend ActiveSupport::Concern

    class_methods do
      def requires_module(mod, **options)
        mod = Licensing.normalize(mod)
        before_action(**options) do
          render_module_locked(mod) unless Licensing.enabled?(Current.account, mod)
        end
      end

      def requires_orders_panel(**options)
        before_action(**options) do
          render_module_locked(:orders) unless Licensing.orders_panel?(Current.account)
        end
      end
    end

    private
      def render_module_locked(mod)
        render inertia: "core/module_locked", props: { module: mod.to_s }, status: :forbidden
      end
  end
end
