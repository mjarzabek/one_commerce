module Chat
  class InboxController < BaseController
    def index
      render inertia: "chat/index"
    end
  end
end
