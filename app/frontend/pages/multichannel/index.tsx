import { Head } from "@inertiajs/react"

import { ModuleHome } from "@/components/module-home"
import { MODULES } from "@/lib/modules"

export default function MultichannelIndex() {
  return (
    <>
      <Head title="MultiChannel" />
      <ModuleHome
        info={MODULES.multichannel}
        nextSteps={[
          "Połączenie z Allegro (OAuth) w Integrations",
          "Adapter MultiChannel::Allegro::OrdersSync na /order/events",
          "Mapowanie ofert na produkty z katalogu",
          "Wysyłanie stanów po zdarzeniu StockChanged",
        ]}
      />
    </>
  )
}
