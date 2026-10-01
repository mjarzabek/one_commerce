import { Head } from "@inertiajs/react"

import { ModuleHome } from "@/components/module-home"
import { MODULES } from "@/lib/modules"

export default function ChatIndex() {
  return (
    <>
      <Head title="Chat" />
      <ModuleHome
        info={MODULES.chat}
        nextSteps={[
          "Modele inboxes, conversations, messages w packs/chat",
          "Adapter Chat::Allegro::Messaging na wspólnym połączeniu Allegro",
          "Messenger i IG DM na połączeniu Meta",
          "Podgląd zamówień kupującego obok rozmowy",
        ]}
      />
    </>
  )
}
