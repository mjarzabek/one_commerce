# OneCommerce - Live · MultiChannel · Chat

Modularny monolit w Ruby on Rails 8.1 z frontendem Inertia.js + React + TypeScript.
Jeden panel, trzy moduły sprzedawane osobno lub razem jako pakiet **ONE**.

| Warstwa | Technologia |
| --- | --- |
| Backend | Ruby 3.4, Rails 8.1, PostgreSQL 16 |
| Frontend | Inertia.js 3 (React 19), TypeScript, Vite, Tailwind CSS 4, shadcn/ui na Base UI |
| Moduły | namespace'y Rubiego w standardowych katalogach `app/` (opis domen: `docs/domains.md`) |
| Joby, cache, WebSockety | Solid Queue, Solid Cache, Solid Cable (na produkcji; w dev adaptery w pamięci) |
| Testy | RSpec, FactoryBot, helpery Inertia |
| Deploy | Docker + Kamal 2 |

## Pierwsze uruchomienie

Wymagania: Ruby 3.4.7, Node.js 22, PostgreSQL 16 działający lokalnie.

```bash
bundle install          # tworzy Gemfile.lock
bin/setup --skip-server # npm install, bazy danych, migracje
bin/rails db:seed       # konta demo
bin/dev                 # Rails (3000) + Vite (3036)
```

Panel: http://localhost:3000. Konta demo (hasło `password123`):

| E-mail | Pakiet | Co zobaczysz |
| --- | --- | --- |
| one@example.com | ONE | Wszystkie moduły i panel zamówień |
| live@example.com | Live (trial 14 dni) | Live + panel zamówień, Chat i MultiChannel zablokowane |
| chat@example.com | Chat | Tylko Chat, bez panelu zamówień |

Seed wypisuje też token API dla `one@example.com`.

Klucz do sekretów produkcyjnych utwórz poleceniem `bin/rails credentials:edit` (powstaną `config/credentials.yml.enc` i `config/master.key`; klucza nie commituj).

## Struktura

```
app/
  frontend/            # React: strony, layouty, komponenty shadcn/ui
    entrypoints/       # inertia.tsx, application.css (motyw)
    pages/             # nazwy stron = nazwy komponentów Inertia, np. "live/index"
    components/ui/     # shadcn/ui (Base UI) - kod w repo, edytuj śmiało
    lib/modules.ts     # opis modułów (menu, pulpit, ekrany „Dokup”)
  views/layouts/       # jeden layout HTML z tagami Vite
  models/              # płasko: Account, User, Current, ApplicationRecord…
    inventory.rb       # moduł domeny: table_name_prefix + operacje (np. Inventory.reserve!)
    inventory/         # Inventory::Product, Inventory::Warehouse… (sekcja „Produkty”)
    orders.rb, orders/ # panel obsługi zamówień (Live lub MultiChannel)
    customers.rb, customers/
    licensing.rb       # licencje modułów, pakiet ONE
  controllers/
    concerns/          # Accounts::Authentication, Licensing::RequiresModule
    inventory/ orders/ live/ multichannel/ chat/
    api/v1/            # publiczne REST API /api/v1
config/routes/         # trasy domen: inventory.rb, orders.rb, live.rb…
```

Domena = namespace w tych samych miejscach: `app/models/<domena>.rb`, `app/models/<domena>/`, `app/controllers/<domena>/`, `config/routes/<domena>.rb`, `spec/…/<domena>/`. Granice trzymamy konwencją: inne domeny zmieniają dane domeny przez metody jej modułu (np. `Inventory.reserve!`), a nie bezpośrednio przez jej modele. Moduły płatne (Live, MultiChannel, Chat) zależą tylko od Core, nigdy od siebie nawzajem.

## Licencje modułów

Jedno źródło prawdy: `Licensing` (`app/models/licensing.rb`).

```ruby
Licensing.enabled?(account, :live)    # czy moduł jest aktywny
Licensing.orders_panel?(account)       # panel zamówień = Live lub MultiChannel
Licensing.grant!(account, :chat, trial_days: 14)
Licensing.grant_bundle!(account, :one) # trzy licencje naraz
```

Kontrolery modułów deklarują wymaganą licencję; bez niej użytkownik widzi ekran z ofertą modułu:

```ruby
module Live
  class BaseController < InertiaController
    requires_module :live
  end
end
```

Frontend dostaje stan licencji we wspólnych propsach (`modules.enabled`, `modules.ordersPanel`, `modules.bundle`) i na tej podstawie buduje menu.

## Dodawanie funkcji do modułu

1. Model w namespace modułu, np. `app/models/live/session.rb` (`Live::Session`).
2. Operacja, z której korzystają inne domeny - metoda w `app/models/live.rb` (albo serwis w `app/services/live/`).
3. Kontroler dziedziczy z `Live::BaseController`, trasa w `config/routes/live.rb`.
4. Strona React w `app/frontend/pages/live/…tsx`, renderowana przez `render inertia: "live/…"`.
5. Testy w `spec/` w tej samej strukturze, np. `spec/models/live/…`, `spec/requests/live/…`.

Nowe komponenty shadcn/ui: konfiguracja jest w `components.json` (styl `base-nova`), więc `npx shadcn@latest add dialog` doda komponent w wersji Base UI do `app/frontend/components/ui`.

## REST API

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/account
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/orders
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/products
```

| Endpoint | Zakres |
| --- | --- |
| `GET /api/v1/orders`, `/orders/:id` | `orders:read` |
| `GET /api/v1/products`, `/products/:id` | `catalog:read` |
| `GET /api/v1/stock` | `inventory:read` |
| `GET /api/v1/customers`, `/customers/:id` | `customers:read` |

Listy są stronicowane kursorem: `?limit=50&cursor=<meta.next_cursor>`. Endpointy danych wymagają tej samej licencji co panel zamówień (Live lub MultiChannel).

## Testy i jakość

```bash
bundle exec rspec           # testy (w tym bramka licencji i API)
npm run check               # TypeScript
bin/rubocop                 # styl Ruby
bin/ci                      # wszystko naraz
```

Te same kroki uruchamia GitHub Actions (`.github/workflows/ci.yml`).

## Deploy

`config/deploy.yml` (Kamal) zakłada serwer w UE i PostgreSQL jako akcesorium. Uzupełnij adres serwera, domenę i rejestr obrazów, ustaw sekrety w `.kamal/secrets`, potem:

```bash
bin/kamal setup   # pierwszy raz
bin/kamal deploy
```

Nazwę produktu wyświetlaną w panelu ustawia zmienna `APP_NAME` (domyślnie „Nazwa”).
