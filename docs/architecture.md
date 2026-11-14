# Architektura

Modularny monolit na namespace'ach Rubiego w standardowych katalogach Rails. Bez Packwerka, engine'ów i mikroserwisów -
granice między domenami trzymamy konwencją (zasady niżej). Opis domen: `docs/domains.md`.

## Warstwy

Zależności idą tylko w dół:

```
Automation                       reguły klienta: wyzwalacz → warunki → akcje
Live · Multichannel · Chat       moduły płatne
Shipping · Invoicing · Payments  realizacja zamówienia
Orders                           zamówienia, pozycje, statusy
Inventory · Customers            produkty, magazyny, stany, rezerwacje · klienci, tożsamości
Integrations                     połączenia: OAuth, tokeny, inbox webhooków
Accounts                         konta, użytkownicy, licencje (płasko)
```

Infrastruktura poza warstwami: `Api::V1::*` (kontrolery REST API), `InertiaController` i pulpit (panel),
`Licensing::RequiresModule` (bramka licencji w kontrolerach).

## Katalogi

Każda domena ma te same miejsca:

```
app/models/orders.rb             module Orders: table_name_prefix "orders_" + operacje (Orders.create_from…)
app/models/orders/               Orders::Order, Orders::Item, Orders::Status…
app/services/orders/             gdy operacja przerośnie moduł
app/jobs/orders/
app/controllers/orders/
config/routes/orders.rb          draw :orders w config/routes.rb
app/frontend/pages/core/orders/  index.tsx, show.tsx
spec/models/, spec/requests/orders/

app/clients/<dostawca>/          surowe API dostawców (HTTP, bez logiki domenowej) - gdy pojawią się integracje
```

Płasko (bez namespace'u) tylko to, czego używają wszystkie domeny: `Account`, `User`, `Membership`, `Session`,
`ApiToken`, `Current`, `ModuleLicense`, `ApplicationRecord`.

## Modele

- Nazwy tabel wynikają z `table_name_prefix` modułu (`orders_items`, `inventory_products`) - bez `self.table_name`.
- Relacje w obrębie domeny nie potrzebują `class_name:`; relacje między domenami tak:
  `belongs_to :product, class_name: "Inventory::Product"`.
- Ta sama nazwa w różnych domenach jest w porządku (`Orders::Item`, `Invoicing::Item`).

## Komunikacja między domenami

1. Czytać można wszędzie, zapisywać tylko przez domenę-właściciela: `Orders` woła `Inventory.reserve!`, a nie
   `Inventory::StockItem.update!`.
2. W dół - bezpośrednie wywołania (`Orders` → `Inventory.reserve!` / `commit!` / `release!`).
3. W górę - zdarzenia. `Orders` ogłasza zmianę statusu, ale nie wie o fakturach ani wysyłkach.
4. Zdarzenia biznesowe subskrybuje tylko `Automation`. `subscribe` w innym miejscu to sygnał ostrzegawczy.
5. Stany magazynowe są wbudowane, nie automatyczne: rezerwacja, zdjęcie ze stanu i zwolnienie to rdzeń
   `Orders` ↔ `Inventory`. Automatyzacje obsługują akcje opcjonalne (faktura, paczka, status, e-mail).
6. UI może przecinać granice: strona zamówienia pokazuje faktury i paczki, a przycisk „Wystaw fakturę” woła tę samą
   operację co automatyzacja.
7. Live i Multichannel tworzą `Orders::Order` (`Orders.create_from`, z `source` i `external_id`), nie własne zamówienia.

## Integracje

- `Integrations::Connection` - połączenie konta z dostawcą (tokeny, zakresy, ważność).
- `app/clients/<dostawca>/` - surowe API; jeden klient Allegro obsługuje Multichannel i Chat, jeden klient Meta - Live i Chat.
- Adaptery w domenie: `Shipping::Carriers::Inpost`, `Invoicing::Providers::Fakturownia`, `Payments::Gateways::Przelewy24`.
- `Orders`, `Inventory` i `Customers` nie wiedzą o żadnym dostawcy.

## Od pierwszego dnia

- `account_id` w każdej tabeli i każdym zapytaniu.
- Idempotentny import: unikalny indeks `(account_id, source, external_id)`.
- Automatyzacje: ochrona przed pętlami, idempotentne akcje (powtórzony job nie tworzy drugiej paczki), log wykonań.
- Kwoty jako `*_cents` + waluta.

## Kiedy wrócić do tych decyzji

| Objaw | Co zrobić |
| --- | --- |
| Domeny wołają się w górę albo w kółko | Packwerk z `enforce_dependencies` |
| Inventory to dwa osobne światy (katalog i magazyn) | Podział na `Catalog` i `Inventory` |
| `inventory.rb` / `orders.rb` mają kilkaset linii | Rozbicie na `app/services/<domena>/` |
| Solid Queue nie wyrabia | Sidekiq |
| Integracja jest duża i niezależna | Engine albo osobny serwis |
