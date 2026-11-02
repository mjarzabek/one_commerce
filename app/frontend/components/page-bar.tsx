import { Link } from "@inertiajs/react"
import { createContext, Fragment, useContext, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type Crumb = { label: string; href?: string }

const SlotContext = createContext<{ slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void }>({
  slot: null,
  setSlot: () => {},
})

export function PageBarProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>
}

// Miejsce w górnym pasku layoutu, do którego strona wstawia okruszki i akcje.
export function PageBarSlot() {
  const { setSlot } = useContext(SlotContext)
  return <div ref={setSlot} className="flex min-w-0 flex-1 items-center justify-between gap-2" />
}

// Okruszki (ostatni = tytuł strony) i akcje strony w górnym pasku.
export function PageBar({ breadcrumbs, actions }: { breadcrumbs: Crumb[]; actions?: ReactNode }) {
  const { slot } = useContext(SlotContext)
  if (!slot) return null

  return createPortal(
    <>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {breadcrumbs.map((item, index) => {
            const last = index === breadcrumbs.length - 1
            return (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator className={last ? undefined : "max-sm:hidden"} />}
                <BreadcrumbItem className={last ? "min-w-0" : "max-sm:hidden"}>
                  {item.href && !last ? (
                    <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate font-medium">{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </>,
    slot,
  )
}
