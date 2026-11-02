# packs/core/inventory – Magazyn

Jedno źródło prawdy o produktach, cenach i stanach dla wszystkich modułów. W panelu: sekcja „Magazyn”
z zakładkami Produkty | Katalogi | Magazyny | Ceny oraz kartami produktu i wariantu (z okruszkami).

Nazewnictwo: **magazyn** = fizyczne miejsce składowania, **stan** = liczba sztuk.

- **Magazyny** – wspólne dla konta, tworzone w zakładce Magazyny.
- **Źródła zamówień** (Live / E-commerce / Ręczne) – dla każdego wybierasz magazyn, z którego schodzi towar,
  i czy zamówienie rezerwuje go od razu (`Inventory.source_settings`, `warehouse_for_source`). Zamówienie
  zapamiętuje swój magazyn; brak towaru w nim = brak towaru (bez pobierania z innych magazynów).
- **Katalogi** – osobne zbiory produktów; w katalogu zaznaczasz, z których magazynów korzysta.
  SKU jest unikalne w katalogu. Nie można odznaczyć magazynu, w którym produkty katalogu mają towar.
- **Produkt prosty** – SKU, EAN, ceny i stan w magazynach.
- **Produkt wariantowy** – produkt główny (opcjonalnie własne SKU i EAN) z wariantami (`parent_id`);
  każdy wariant ma SKU, EAN, ceny i stan. Stan produktu głównego = suma wariantów.
- **Stan łączny** = suma magazynów katalogu produktu. Na liście produktów kolumna „Stan” pokazuje stan łączny
  albo stan wybranego magazynu.
- **Grupy cenowe katalogu** – katalog wybiera, z których grup cenowych korzysta; produkty mają ceny w tych grupach.
- **Grupy cenowe** – np. „Detal”, „Allegro”, „EU” (EUR). Domyślna obsługuje Live i zamówienia ręczne.
- **Rezerwacje**: z rezerwacją `reserve!(…, warehouse_id:)` → `commit!` / `release!`; bez – `deduct!(…, warehouse_id:)`
  przy wysyłce. Zwrot: `restock!` (do magazynu, z którego towar wyszedł).
- Każda zmiana stanu zostawia wpis w `inventory_movements` (z magazynem, autorem i posiadaczem).

Inne pakiety używają tylko `Inventory` z `app/public` (np. `Inventory.find_products` zwraca `Inventory::ProductInfo`
dla produktów prostych i wariantów).
