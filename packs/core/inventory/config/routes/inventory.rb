# Inventory (w panelu sekcja „Produkty”): lista produktów (Produkty | Zestawy), karta produktu i wariantu
# oraz ustawienia (Ogólne | Katalogi | Magazyny | Ceny).
scope "inventory", module: :inventory, as: :inventory do
  root "products#index"
  get "bundles", to: "bundles#index", as: :bundles
  scope "settings", as: :settings do
    get "/", to: redirect("/inventory/settings/general", status: 302)
    get "general", to: "settings#general", as: :general
    patch "sources", to: "settings#sources", as: :sources
    resources :catalogs, only: %i[index create update destroy]
    resources :warehouses, only: %i[index create update destroy]
    resources :price_groups, path: "prices", only: %i[index create update destroy]
  end
  resources :products, only: %i[new create edit update destroy] do
    post :bulk, on: :collection
    post :adjustments, on: :member
    resources :variants, shallow: true, only: %i[new create edit update destroy]
  end
  resources :reservations, only: [] do
    member do
      post :release
      post :fulfill
    end
  end
end
