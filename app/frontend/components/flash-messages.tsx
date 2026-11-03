import { usePage } from "@inertiajs/react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { Toaster } from "@/components/ui/sonner"

// Komunikaty z `redirect_to …, notice:/alert:` jako toasty - pływają nad treścią, więc nie przesuwają układu strony.
// Zielony - sukces (`notice`), pomarańczowy - uwaga (`warning`), czerwony - błąd (`alert`).
// Błąd i uwaga zostają do zamknięcia, potwierdzenie znika samo.
export function FlashMessages() {
  const { flash } = usePage()
  // Każda odpowiedź serwera daje nowy obiekt `flash`; StrictMode odpala efekt dwa razy dla tego samego.
  const shown = useRef<typeof flash | null>(null)

  useEffect(() => {
    if (!flash || shown.current === flash) return
    shown.current = flash
    if (flash.alert) toast.error(flash.alert, { duration: Infinity, closeButton: true })
    if (flash.warning) toast.warning(flash.warning, { duration: Infinity, closeButton: true })
    if (flash.notice) toast.success(flash.notice)
  }, [flash])

  return <Toaster position="bottom-right" />
}
