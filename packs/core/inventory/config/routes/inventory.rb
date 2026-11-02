# Sekcja „Magazyn”: zakładki Produkty | Katalogi | Magazyny | Ceny, karta produktu i wariantu.
scope "inventory", module: :inventory, as: :inventory do
  root "products#index"
  resources :products, only: %i[new create edit update destroy] do
    post :bulk, on: :collection
    post :adjustments, on: :member
    resources :variants, shallow: true, only: %i[new create edit update destroy]
  end
  resources :catalogs, only: %i[index create update destroy]
  resources :warehouses, only: %i[index create update destroy]
  patch "sources", to: "warehouses#sources", as: :sources
  resources :reservations, only: [] do
    member do
      post :release
      post :fulfill
    end
  end
  resources :price_groups, path: "prices", only: %i[index create update destroy]
end
