import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react"

import { PageBar } from "@/components/page-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ModuleInfo } from "@/lib/modules"

// Wspólny szkielet ekranu startowego modułu – do zastąpienia prawdziwymi widokami.
export function ModuleHome({ info, nextSteps }: { info: ModuleInfo; nextSteps: string[] }) {
  return (
    <>
      <PageBar breadcrumbs={[{ label: info.name }]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zakres MVP</CardTitle>
            <CardDescription>Co zbuduje ten moduł w pierwszej wersji.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {info.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckCircle2Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Następne kroki w kodzie</CardTitle>
            <CardDescription>Pakiet modułu jest gotowy na pierwsze funkcje.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {nextSteps.map((step) => (
                <li key={step} className="flex gap-2">
                  <CircleDashedIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  {step}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
