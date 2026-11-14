import { Head } from "@inertiajs/react"

import { ModuleHome } from "@/components/module-home"
import { MODULES } from "@/lib/modules"

export default function LiveIndex() {
  return (
    <>
      <Head title="Live" />
      <ModuleHome
        info={MODULES.live}
        nextSteps={[
          "Połączenie z Meta (strona FB, konto IG) w Integrations",
          "Model live_sessions i claims (rezerwacje z komentarzy) w Live",
          "Odbiór webhooków live_comments przez inbox i job",
          "Panel prowadzącego na Action Cable",
        ]}
      />
    </>
  )
}
