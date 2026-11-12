# packs/core/orders

Panel obsługi zamówień: zamówienia ze wszystkich źródeł, własne statusy w grupach, masowe akcje. Dostępny przy licencji Live lub MultiChannel.

- `Orders.create_from(...)` - jedyne wejście dla modułów: klient, migawka pozycji, sumy, numer `RRRR/NNNNNN`, rezerwacja towaru, domyślny status konta. Idempotentne po `source` + `external_id`.
- Statusy (`Orders::Status`) i grupy (`Orders::StatusGroup`) definiuje konto w Zamówienia › Ustawienia › Statusy; `Orders.ensure_setup!` tworzy domyślne. Jeden status jest domyślny dla nowych zamówień.
- `Orders.change_status!(order, status, user:, note:)` - dowolny status na dowolny, z wpisem w historii (`Orders::StatusChange`, nazwy statusów jako migawka). Status nie zmienia magazynu.
- Skutki w magazynie wołane osobno (docelowo przez automatyzacje): `fulfill_stock!` (wysyłka - realizacja rezerwacji / zdjęcie ze stanu), `release_stock!` (anulowanie), `restock!` (zwrot).
- Płatność: `paid_cents` (kwota wpłacona, „Zapłacono X z Y”) i `payment_method` (transfer / online / cod - za pobraniem / cash). `payment_status` (unpaid / partial / paid / overpaid) jest wyliczany przy zapisie z kwoty wpłaconej i wartości zamówienia - zmiana przez `Orders.update_payment!`.
- Adresy (`shipping_address`, `billing_address`): `{ name, company, street, postal_code, city, country, phone }`.
- Kwoty w groszach (`*_cents`), do wyświetlenia `Orders.format_money`.
