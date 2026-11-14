import type { ReactNode } from "react"

// Treść od krawędzi do krawędzi obszaru strony - bez szarego marginesu i karty. Dla stron z jedną dużą tabelą,
// gdzie karta tylko zabiera miejsce. Obszar dostaje wtedy tło karty (patrz `app-layout`), a toolbar i tabela
// wyrównują się do tytułu strony przez `--table-inset`. `text-sm` - bazowy rozmiar tekstu jak w `Card`.
export function FullBleed({ children }: { children: ReactNode }) {
  return (
    <div data-full-bleed className="-mx-4 -mb-4 flex flex-1 flex-col text-sm [--table-inset:--spacing(4)] md:-mx-6 md:-mb-6 md:[--table-inset:--spacing(6)]">
      {children}
    </div>
  )
}

// Zakładki (`TabNav`) w `FullBleed`: tekst pierwszej zakładki w linii z tytułem strony (zakładka ma własne px-3).
export const fullBleedTabsClass = "mt-0 px-[calc(var(--table-inset)-var(--spacing)*3)]"
