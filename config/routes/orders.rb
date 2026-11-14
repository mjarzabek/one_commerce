# Panel zamówień: lista, karta zamówienia i ustawienia (statusy i ich grupy, pola dodatkowe).
scope "orders/settings", module: :orders, as: :orders_settings do
  get "/", to: redirect("/orders/settings/statuses", status: 302)
  resources :statuses, only: %i[index create update destroy] do
    patch :reorder, on: :collection
    patch :default, on: :member
  end
  resources :status_groups, path: "groups", only: %i[create update destroy]
  resources :custom_fields, path: "fields", only: %i[index create update destroy] do
    patch :reorder, on: :collection
  end
end

scope module: :orders do
  resources :orders, only: %i[index show update] do
    post :bulk, on: :collection
    member do
      patch :status, action: :change_status
      patch :payment
      patch :shipping
      patch :address
      patch :customer
      patch :fields
    end
    resources :items, only: %i[create update destroy] do
      get :products, on: :collection
    end
  end
end
