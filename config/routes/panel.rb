resource :session, only: %i[new create destroy]
get "login", to: "sessions#new"
root "dashboard#show"
