import { Head, Link } from "@inertiajs/react"
import { CheckIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MODULES, ORDERS_PANEL } from "@/lib/modules"
import type { ModuleKey } from "@/types"

type Props = { module: ModuleKey | "orders" }

// Ekran pokazywany zamiast modułu, na który konto nie ma licencji.
export default function ModuleLocked({ module }: Props) {
  const info = module === "orders" ? ORDERS_PANEL : MODULES[module]

  return (
    <>
      <Head title={info.name} />
      <div className="flex flex-1 items-start justify-center pt-8 md:pt-16">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="bg-muted mb-2 flex size-10 items-center justify-center rounded-lg">
              <LockIcon className="size-5" />
            </div>
            <CardTitle className="text-xl">
              {module === "orders" ? "Panel zamówień" : `Moduł ${info.name}`} nie jest aktywny na tym koncie
            </CardTitle>
            <CardDescription>{info.tagline}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {info.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="gap-2">
            {/* Do podpięcia: zakup/trial modułu przez billing (sekcja 5 planu). */}
            <Button disabled>{module === "orders" ? "Dodaj Live lub MultiChannel" : "Rozpocznij 14 dni za darmo"}</Button>
            <Button variant="ghost" render={<Link href="/" />}>
              Wróć do pulpitu
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}
