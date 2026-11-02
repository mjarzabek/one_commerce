import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PaginationState = { page: number; pages: number; per: number; total: number }

// Zawsze 5 pozycji między strzałkami, żeby paginacja nie zmieniała szerokości.
// Okno przesuwa się o jedną stronę – zawsze widać poprzednią i następną:
//   początek ‹ 1 2 3 … 20 ›   środek ‹ 9 10 11 … 20 ›   koniec ‹ 16 17 18 19 20 ›
// Przy maksymalnie 5 stronach – wszystkie numery.
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1)
  if (page <= 2) return [1, 2, 3, "gap", pages]
  if (page >= pages - 3) return [pages - 4, pages - 3, pages - 2, pages - 1, pages]
  return [page - 1, page, page + 1, "gap", pages]
}

// „…” – po kliknięciu pole do wpisania numeru strony (Enter przechodzi).
function GapJump({ pages, onJump }: { pages: number; onJump: (page: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" className="min-w-8 px-1.5" aria-label="Przejdź do strony…" onClick={() => setEditing(true)}>
        …
      </Button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const target = Number.parseInt(value, 10)
        if (Number.isFinite(target)) onJump(target)
        setEditing(false)
        setValue("")
      }}
    >
      <Input
        autoFocus
        type="number"
        min={1}
        max={pages}
        inputMode="numeric"
        aria-label={`Numer strony (1–${pages})`}
        placeholder="nr"
        className="h-8 w-14 px-1.5 text-center tabular-nums"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false)
          setValue("")
        }}
      />
    </form>
  )
}

// Stronicowanie listy: „[1–25 ▾] z 53 produkty” (liczba na stronę w menu) i ‹ 1 2 … 7 ›.
export function Pagination({
  pagination,
  onPage,
  onPer,
  perOptions = [25, 50, 100],
  noun = "",
}: {
  pagination: PaginationState
  onPage: (page: number) => void
  onPer: (per: number) => void
  perOptions?: number[]
  noun?: string
}) {
  const { page, pages, per, total } = pagination
  const first = total === 0 ? 0 : (page - 1) * per + 1
  const last = Math.min(page * per, total)
  const go = (target: number) => {
    const next = Math.min(Math.max(1, target), pages)
    if (next !== page) onPage(next)
  }

  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="text-foreground -ml-2 px-2 tabular-nums" aria-label="Liczba pozycji na stronę">
                {first}–{last}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={String(per)} onValueChange={(value) => onPer(Number(value))}>
              {perOptions.map((option) => (
                <DropdownMenuRadioItem key={option} value={String(option)}>
                  {option} na stronę
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="tabular-nums">
          z {total}
          {noun && ` ${noun}`}
        </span>
      </div>

      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Stronicowanie">
          <Button variant="ghost" size="icon-sm" aria-label="Poprzednia strona" disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeftIcon />
          </Button>
          {pageWindow(page, pages).map((item, index) =>
            item === "gap" ? (
              <GapJump key={`gap-${index}`} pages={pages} onJump={go} />
            ) : (
              <Button
                key={item}
                variant={item === page ? "outline" : "ghost"}
                size="sm"
                className={cn("min-w-8 px-2 tabular-nums", item === page ? "text-foreground font-semibold" : "text-muted-foreground")}
                aria-label={`Strona ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => go(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Następna strona" disabled={page >= pages} onClick={() => go(page + 1)}>
            <ChevronRightIcon />
          </Button>
        </nav>
      )}
    </div>
  )
}
