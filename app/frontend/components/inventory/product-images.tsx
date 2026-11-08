import { router } from "@inertiajs/react"
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, ImagePlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"

import { ConfirmDelete } from "@/components/inventory/confirm-button"
import type { ProductImage } from "@/components/inventory/types"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
const LIMIT = 16

// Zdjęcia produktu: dodawanie (przycisk albo przeciągnięcie), kolejność (pierwsze = główne) i usuwanie.
// Zapisują się od razu - poza paskiem zapisu formularza. Wariant ma własne zdjęcia, a po nich zdjęcia produktu głównego
// (`inherited`, tylko podgląd) - zdjęciem głównym wariantu jest jego pierwsze własne zdjęcie albo zdjęcie produktu.
export function ProductImagesCard({ productId, images, inherited }: { productId: number | null; images: ProductImage[]; inherited?: ProductImage[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const options = { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false) }

  const upload = (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"))
    if (!productId || list.length === 0) return
    router.post(`/inventory/products/${productId}/images`, { images: list }, { ...options, forceFormData: true })
  }
  const move = (image: ProductImage, position: number) => router.patch(`/inventory/images/${image.id}`, { position }, options)

  if (!productId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zdjęcia</CardTitle>
          <CardDescription>{inherited ? "Własne zdjęcia wariantu dodasz po jego zapisaniu." : "Zdjęcia dodasz po zapisaniu produktu."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zdjęcia</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" disabled={processing || images.length >= LIMIT} onClick={() => input.current?.click()}>
            <ImagePlusIcon />
            Dodaj zdjęcia
          </Button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ""
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 rounded-lg transition-colors",
            dragging && "bg-primary/5 ring-primary/40 ring-2 ring-dashed",
            processing && "pointer-events-none opacity-60",
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            upload(e.dataTransfer.files)
          }}
        >
          {images.map((image, index) => (
            <figure key={image.id} className="group/image bg-muted relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <img src={image.url} alt={image.name} className="size-full object-cover" loading="lazy" />
              {index === 0 && (
                <span className="bg-background/90 absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium shadow-sm">
                  <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                  Główne
                </span>
              )}
              <div className="bg-background/90 absolute inset-x-1.5 bottom-1.5 flex items-center justify-between rounded-md p-0.5 opacity-0 shadow-sm transition-opacity group-hover/image:opacity-100 focus-within:opacity-100">
                <div className="flex">
                  <Button variant="ghost" size="icon-xs" aria-label="Przesuń w lewo" disabled={index === 0} onClick={() => move(image, index - 1)}>
                    <ChevronLeftIcon />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label="Przesuń w prawo" disabled={index === images.length - 1} onClick={() => move(image, index + 1)}>
                    <ChevronRightIcon />
                  </Button>
                  {index > 0 && (
                    <Button variant="ghost" size="icon-xs" aria-label="Ustaw jako główne" title="Ustaw jako główne" onClick={() => move(image, 0)}>
                      <StarIcon />
                    </Button>
                  )}
                </div>
                <ConfirmDelete
                  title="Usunąć zdjęcie?"
                  description={index === 0 && images.length > 1 ? "Zdjęciem głównym zostanie następne zdjęcie." : "Zdjęcie zostanie usunięte z produktu."}
                  url={`/inventory/images/${image.id}`}
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label={`Usuń zdjęcie ${image.name}`} className="text-destructive">
                      <Trash2Icon />
                    </Button>
                  }
                />
              </div>
            </figure>
          ))}
          {images.length < LIMIT && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:border-foreground/30 flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs transition-colors"
              title={`JPG, PNG, WEBP lub GIF, do 10 MB, najwyżej ${LIMIT}`}
              onClick={() => input.current?.click()}
            >
              {images.length === 0 ? <ImageIcon className="size-5" /> : <ImagePlusIcon className="size-5" />}
              {images.length === 0 ? "Dodaj lub przeciągnij zdjęcia" : "Dodaj"}
            </button>
          )}
          {inherited?.map((image, index) => (
            <figure key={`parent-${image.id}`} className="bg-muted relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <img src={image.url} alt={image.name} className="size-full object-cover opacity-70" loading="lazy" />
              {images.length === 0 && index === 0 && (
                <span className="bg-background/90 absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium shadow-sm">
                  <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                  Główne
                </span>
              )}
            </figure>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
