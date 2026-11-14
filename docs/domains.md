# Domeny

Opis modułów aplikacji. Każda domena ma swój namespace i te same miejsca w katalogach:
`app/models/<domena>.rb` (moduł, `table_name_prefix`, operacje), `app/models/<domena>/`, `app/controllers/<domena>/`,
`config/routes/<domena>.rb`, `spec/…/<domena>/`. Zasady architektury: `docs/architecture.md`.

## platform

Fundament techniczny: klasy bazowe (ApplicationRecord, ApplicationController, ApplicationJob, ApplicationMailer). Nie zależy od niczego.

## accounts

Konta firm (tenant), użytkownicy, członkostwa, sesje logowania, tokeny API. Publiczne API: `Current`, `Accounts::Authentication`.

## licensing

Licencje modułów (Live, MultiChannel, Chat, pakiet ONE). Publiczne API: `Licensing`, `Licensing::RequiresModule`.

## panel

Powłoka panelu: `InertiaController` (wspólne propsy: użytkownik, konto, włączone moduły), pulpit.

## api

Publiczne REST API dla klientów: `/api/v1`, tokeny z zakresami, wersjonowanie. Zasady: JSON, paginacja kursorem,
bramka licencji taka sama jak w panelu.

## customers

Klienci i ich tożsamości z kanałów (FB, IG, Allegro, e-mail, sklep).

- `Customers.find_or_create_by_identity!` - klient z kanału, bez duplikatów (unikalne konto + kanał + external_id).
- `Customers.find_or_create!` - klient ręczny, dopasowanie po e-mailu.

## Inventory (w panelu: sekcja „Produkty”)

Jedno źródło prawdy o produktach, cenach i stanach dla wszystkich modułów. W panelu: sekcja „Produkty”
(`/inventory`) z dwiema częściami:
- **Lista produktów** - zakładki Produkty | Zestawy (zestawy: wkrótce) oraz karty produktu i wariantu (z okruszkami);
- **Ustawienia** (`/inventory/settings`) - zakładki Ogólne | Katalogi | Magazyny | Ceny | Kategorie (źródła zamówień i rezerwacje).

Nazewnictwo: **magazyn** = fizyczne miejsce składowania, **stan** = liczba sztuk.

- **Magazyny** - wspólne dla konta, tworzone w Ustawieniach → Magazyny.
- **Karta produktu** - zakładki: Karta produktu (dane, zdjęcia, opis + opisy dodatkowe 1-3, parametry, wymiary i waga),
  Sprzedaż (ceny brutto z VAT i stan - zapisywane razem z danymi), Warianty, Historia (stany i ceny), Rezerwacje (gdy
  któreś źródło rezerwuje), Kanały. Każda zmiana ceny trafia do `inventory_price_changes`.
- **Warianty** - produkt z wariantami nie ma własnych cen ani stanu (`sellable?`): zakładka Sprzedaż znika, a zakładka
  Warianty ma domyślny VAT wariantów i tabelę wariantów z wierszem „Razem” (wyliczonym, bez edycji). Nowy wariant dostaje
  podpowiedź cen z ostatniego wariantu (pierwszy - z cen produktu).
- **Karta wariantu** - wariant to pełnoprawny produkt z tymi samymi zakładkami i polami co produkt (dane, status, zdjęcia,
  opisy, parametry, wymiary, VAT, ceny, stan, historia, rezerwacje, kanały). Dziedziczenie z produktu głównego:
  VAT, opisy, wymiary i waga - puste pole (NULL) = wartość produktu (`Product#effective`); parametry - produktu +
  własne, własny o tej samej nazwie nadpisuje (`effective_parameters`); zdjęcia - własne, a po nich produktu
  (`effective_images`). Dzięki temu warianty importowane ze sklepów mogą mieć własne opisy, zdjęcia, VAT i parametry.
- **Status** - Szkic albo Aktywny.
- **Producent** - zwykły tekst na karcie produktu (wariant bez własnego dziedziczy producenta produktu głównego).
- **Kategorie** (Ustawienia → Kategorie) - drzewo (kategoria nadrzędna); kategoria **ogólna** (bez katalogu, do wyboru
  w każdym katalogu) albo **katalogu**. Nadrzędna musi być ogólna albo z tego samego katalogu. Tworzone ręcznie albo
  importowane z marketplace'ów (`Inventory.import_categories!` - `source` np. „allegro” + `external_id`; ponowny import
  aktualizuje nazwy i drzewo). Produkt ma jedną kategorię (wybór z wyszukiwaniem), wariant dziedziczy ją z produktu.
  Usunięcie kategorii zostawia produkty bez kategorii; kategorii z podkategoriami nie można usunąć.
- **Usuwanie i duplikowanie** (menu „⋯” na karcie) - usunięcie zabiera produkt z wariantami, zdjęciami, stanem,
  historią i rezerwacjami; pozycje zamówień zostają (mają własną nazwę, SKU i cenę) bez powiązania z produktem.
  Duplikat to szkic z danymi, cenami, zdjęciami i wariantami - bez stanu i historii, z SKU „…-KOPIA” i pustym EAN.
- **Zmiana stanu** - domyślnie stan to zwykłe pole na karcie produktu (zakładka „Sprzedaż”, `set_on_hand!`); historia
  zapisuje, z ilu na ile. Magazyn ze **ścisłą kontrolą** (`strict_control`, przełącznik w Ustawieniach → Magazyny)
  blokuje ręczne zmiany (`Inventory::StrictControl`) - stan zmieniają tam tylko dokumenty magazynowe (wkrótce) i zamówienia.
- **Źródła zamówień** (Live / E-commerce / Ręczne, Ustawienia → Ogólne) - dla każdego wybierasz magazyn, z którego schodzi towar,
  i czy zamówienie rezerwuje go od razu (`Inventory.source_settings`, `warehouse_for_source`). Zamówienie
  zapamiętuje swój magazyn; brak towaru w nim = brak towaru (bez pobierania z innych magazynów).
- **Katalogi** - osobne zbiory produktów; w katalogu zaznaczasz, z których magazynów korzysta.
  SKU jest unikalne w katalogu. Nie można odznaczyć magazynu, w którym produkty katalogu mają towar.
- **Produkt prosty** - SKU, EAN, ceny i stan w magazynach.
- **Produkt wariantowy** - produkt główny (opcjonalnie własne SKU i EAN) z wariantami (`parent_id`);
  każdy wariant ma SKU, EAN, ceny i stan, a treści i VAT dziedziczy (patrz Karta wariantu). Stan produktu głównego = suma wariantów.
- **Stan łączny** = suma magazynów katalogu produktu. Na liście produktów kolumna „Stan” pokazuje stan łączny
  albo stan wybranego magazynu.
- **Grupy cenowe katalogu** - katalog wybiera, z których grup cenowych korzysta; produkty mają ceny w tych grupach.
- **Grupy cenowe** - np. „Detal”, „Allegro”, „EU” (EUR). Domyślna obsługuje Live i zamówienia ręczne.
- **Rezerwacje**: z rezerwacją `reserve!(…, warehouse_id:)` → `commit!` / `release!`; bez - `deduct!(…, warehouse_id:)`
  przy wysyłce. Zwrot: `restock!` (do magazynu, z którego towar wyszedł).
- Każda zmiana stanu zostawia wpis w `inventory_movements` (z magazynem, autorem i posiadaczem).

Inne domeny zmieniają produkty i stany tylko przez metody modułu `Inventory` (np. `Inventory.find_products` zwraca `Inventory::ProductInfo`
dla produktów prostych i wariantów).

## orders

Panel obsługi zamówień: zamówienia ze wszystkich źródeł, własne statusy w grupach, masowe akcje. Dostępny przy licencji Live lub MultiChannel.

- `Orders.create_from(...)` - jedyne wejście dla modułów: klient, migawka pozycji, sumy, numer `RRRR/NNNNNN`, rezerwacja towaru, domyślny status konta. Idempotentne po `source` + `external_id`.
- Statusy (`Orders::Status`) i grupy (`Orders::StatusGroup`) definiuje konto w Zamówienia › Ustawienia › Statusy; `Orders.ensure_setup!` tworzy domyślne. Jeden status jest domyślny dla nowych zamówień.
- `Orders.change_status!(order, status, user:, note:)` - dowolny status na dowolny, z wpisem w historii (`Orders::StatusChange`, nazwy statusów jako migawka). Status nie zmienia magazynu.
- Skutki w magazynie wołane osobno (docelowo przez automatyzacje): `fulfill_stock!` (wysyłka - realizacja rezerwacji / zdjęcie ze stanu), `release_stock!` (anulowanie), `restock!` (zwrot).
- Płatność: `paid_cents` (kwota wpłacona, „Zapłacono X z Y”) i `payment_method` (transfer / online / cod - za pobraniem / cash). `payment_status` (unpaid / partial / paid / overpaid) jest wyliczany przy zapisie z kwoty wpłaconej i wartości zamówienia - zmiana przez `Orders.update_payment!`.
- Adresy (`shipping_address`, `billing_address`): `{ name, company, street, postal_code, city, country, phone }`.
- Kwoty w groszach (`*_cents`), do wyświetlenia `Orders.format_money`.

## invoicing

Faktury. MVP: Fakturownia + KSeF.

## payments

Płatności. MVP: Przelewy24.

## shipping

Wysyłki i etykiety. MVP: InPost (ShipX).

## integrations

Połączenia z kanałami (Allegro, Meta, sklepy, e-mail): OAuth, tokeny, zakresy, inbox webhooków. Moduły budują na nich własne adaptery.

## live

[Nazwa] Live: sprzedaż na transmisjach FB/IG, kody w komentarzach, rezerwacje, koszyk.

## multichannel

[Nazwa] MultiChannel: zamówienia i stany z marketplace'ów i sklepów.

## chat

[Nazwa] Chat: wspólna skrzynka wiadomości (Allegro, Messenger, IG, e-mail).

