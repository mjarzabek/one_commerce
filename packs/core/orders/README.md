# packs/core/orders

Panel obsługi zamówień: zamówienia ze wszystkich źródeł, statusy, masowe akcje. Dostępny przy licencji Live lub MultiChannel.

- `Orders.create_from(...)` – jedyne wejście dla modułów: klient, migawka pozycji, sumy, numer `RRRR/NNNNNN`, rezerwacja towaru. Idempotentne po `source` + `external_id`.
- `Orders.transition!(order, to:)` – zmiana statusu wg `Orders::Order::TRANSITIONS`; wysłane zdejmuje ze stanu, anulowane zwalnia rezerwację, zwrócone przyjmuje towar z powrotem.
- Kwoty w groszach (`*_cents`), do wyświetlenia `Orders.format_money`.
