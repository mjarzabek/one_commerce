// Polska liczba mnoga: plural(n, ["produkt", "produkty", "produktów"]).
export const plural = (count: number, [one, few, many]: readonly [string, string, string]) =>
  count === 1 ? one : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? few : many
