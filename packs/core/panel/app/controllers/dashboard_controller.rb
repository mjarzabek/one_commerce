# Pulpit: stan modułów konta i skróty.
class DashboardController < InertiaController
  def show
    render inertia: "core/dashboard"
  end
end
