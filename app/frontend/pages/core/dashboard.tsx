import { Head, Link, usePage } from "@inertiajs/react"
import { ArrowRightIcon, LockIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MODULE_ORDER, MODULES, ORDERS_PANEL, type ModuleInfo } from "@/lib/modules"

function ModuleCard({ info, enabled }: { info: ModuleInfo; enabled: boolean }) {
  const Icon = info.icon

  return (
    <Card className={enabled ? undefined : "bg-muted/30"}>
      <CardHeader>
        <div className="bg-muted mb-2 flex size-9 items-center justify-center rounded-lg">
          <Icon className="size-4.5" />
        </div>
        <CardTitle>{info.name}</CardTitle>
        <CardDescription>{info.tagline}</CardDescription>
        <CardAction>
          {enabled ? (
            <Badge variant="secondary">Aktywny</Badge>
          ) : (
            <Badge variant="outline">
              <LockIcon />
              Niedostępny
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          {info.features.slice(0, 3).map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant={enabled ? "default" : "outline"} size="sm" render={<Link href={info.href} />}>
          {enabled ? "Otwórz" : "Zobacz ofertę"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function Dashboard() {
  const { auth, account, modules } = usePage().props
  const enabled = modules?.enabled ?? []
  const firstName = auth?.user.name.split(" ")[0]

  return (
    <>
      <Head title="Pulpit" />
      <PageHeader
        title={`Dzień dobry, ${firstName}`}
        description={`Konto ${account?.name ?? ""}${modules?.bundle === "one" ? " · pakiet ONE" : ""}`}
      />

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium">Obsługa zamówień</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard info={ORDERS_PANEL} enabled={!!modules?.ordersPanel} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium">Moduły</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULE_ORDER.map((key) => (
            <ModuleCard key={key} info={MODULES[key]} enabled={enabled.includes(key)} />
          ))}
        </div>
      </section>
    </>
  )
}
