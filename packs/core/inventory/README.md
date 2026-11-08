# packs/core/inventory - Inventory (w panelu: sekcja „Produkty”)

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

Inne pakiety używają tylko `Inventory` z `app/public` (np. `Inventory.find_products` zwraca `Inventory::ProductInfo`
dla produktów prostych i wariantów).
