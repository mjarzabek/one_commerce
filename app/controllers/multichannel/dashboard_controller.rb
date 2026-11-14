module Multichannel
  class DashboardController < BaseController
    def index
      render inertia: "multichannel/index"
    end
  end
end
