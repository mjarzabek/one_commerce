namespace :api, defaults: { format: :json } do
  namespace :v1 do
    resource :account, only: :show
    resources :orders, only: :index
  end
end
