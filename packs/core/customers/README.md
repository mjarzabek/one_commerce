# packs/core/customers

Klienci i ich tożsamości z kanałów (FB, IG, Allegro, e-mail, sklep).

- `Customers.find_or_create_by_identity!` - klient z kanału, bez duplikatów (unikalne konto + kanał + external_id).
- `Customers.find_or_create!` - klient ręczny, dopasowanie po e-mailu.
