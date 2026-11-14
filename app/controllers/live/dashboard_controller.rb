module Live
  class DashboardController < BaseController
    def index
      render inertia: "live/index"
    end
  end
end
