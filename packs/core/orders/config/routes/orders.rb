scope module: :orders do
  resources :orders, only: %i[index]
end
