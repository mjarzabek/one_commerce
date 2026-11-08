import { Link } from "@inertiajs/react"
import { ChevronRightIcon, HistoryIcon, ImageIcon, LayersIcon } from "lucide-react"
import { Fragment, useState, type ReactNode } from "react"

import { variantsWord } from "@/components/inventory/types"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Row } from "./types"

// Miniatura zdjęcia produktu; bez zdjęcia (albo gdy miniatura się nie wczyta) - placeholder.
export function ProductThumb({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {src && !failed ? (
        <img src={src} alt={name} loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageIcon className="size-4" aria-label="Brak zdjęcia" />
      )}
    </span>
  )
}

// Wcięcie wariantu w miejscu miniatury.
export function VariantMarker() {
  return (
    <span className="text-muted-foreground flex size-9 shrink-0 items-center justify-center" aria-hidden>
      ↳
    </span>
  )
}

// Komórka „Produkt”: miniatura (u wariantu „↳”), nazwa z opcjonalnym dodatkiem (przełącznik wariantów),
// a pod nią ID · SKU · EAN (bez pustych).
export function ProductCell({ row, href, image, addon, variant = false }: { row: Row; href: string; image: ReactNode; addon?: ReactNode; variant?: boolean }) {
  const codes = (
    [
      ["ID", row.id],
      ["SKU", row.sku],
      ["EAN", row.ean],
    ] as const
  ).filter(([, value]) => value != null && value !== "")
  return (
    <div className="flex min-w-0 items-center gap-3">
      {image}
      <div className="max-w-md min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            className={cn("hover:text-primary truncate underline-offset-4 hover:underline", !variant && "font-medium")}
            title={variant ? `Edytuj wariant „${row.name}”` : `Edytuj produkt „${row.name}”`}
          >
            {row.name}
          </Link>
          {addon}
        </div>
        <p className="text-muted-foreground truncate text-xs tabular-nums" title={codes.map(([label, value]) => `${label} ${value}`).join(" · ")}>
          {codes.map(([label, value], index) => (
            <Fragment key={label}>
              {index > 0 && " · "}
              <span className="opacity-70">{label}</span> {value}
            </Fragment>
          ))}
        </p>
      </div>
    </div>
  )
}

// Przełącznik rozwijania wariantów obok nazwy produktu.
export function VariantsToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="xs"
      className="text-muted-foreground -my-1 h-5 shrink-0 tabular-nums"
      title={`${open ? "Zwiń" : "Rozwiń"}: ${count} ${variantsWord(count)}`}
      aria-label={`${open ? "Zwiń" : "Rozwiń"} warianty (${count})`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <LayersIcon data-icon="inline-start" />
      {count}
      <ChevronRightIcon data-icon="inline-end" className={cn("transition-transform", open && "rotate-90")} />
    </Button>
  )
}

// Skrót do historii stanów i cen na karcie produktu albo wariantu.
export function HistoryLink({ href, name }: { href: string; name: string }) {
  return (
    <Link
      href={href}
      title="Historia stanów i cen"
      aria-label={`Historia - ${name}`}
      className={buttonVariants({ variant: "ghost", size: "icon-xs", className: "text-muted-foreground" })}
    >
      <HistoryIcon />
    </Link>
  )
}
