namespace :api, defaults: { format: :json } do
  namespace :v1 do
    resource :account, only: :show
    resources :orders, only: %i[index show]
    resources :products, only: %i[index show]
    resources :stock, only: :index
    resources :customers, only: %i[index show]
  end
end
