import { LayersIcon, MessagesSquareIcon, PackageIcon, RadioIcon, type LucideIcon } from "lucide-react"

import type { ModuleKey } from "@/types"

export type ModuleInfo = {
  key: ModuleKey | "orders"
  name: string
  href: string
  icon: LucideIcon
  tagline: string
  features: string[]
}

// Opis modułów w jednym miejscu: menu, pulpit i ekrany „Dokup”.
export const MODULES: Record<ModuleKey, ModuleInfo> = {
  live: {
    key: "live",
    name: "Live",
    href: "/live",
    icon: RadioIcon,
    tagline: "Sprzedaż na transmisjach Facebook i Instagram.",
    features: [
      "Kody produktów w komentarzach i automatyczne rezerwacje",
      "Kolejka chętnych, gdy zabraknie towaru",
      "Wiadomość z linkiem do koszyka i płatność Przelewy24",
      "Panel prowadzącego w czasie rzeczywistym",
    ],
  },
  multichannel: {
    key: "multichannel",
    name: "MultiChannel",
    href: "/multichannel",
    icon: LayersIcon,
    tagline: "Zamówienia i stany z marketplace'ów i sklepów internetowych.",
    features: [
      "Import zamówień z Allegro, WooCommerce, Shopify i PrestaShop",
      "Synchronizacja stanów magazynowych między kanałami",
      "Statusy i numery przesyłek odsyłane do kanałów",
      "Automatyzacje zależne od kanału",
    ],
  },
  chat: {
    key: "chat",
    name: "Chat",
    href: "/chat",
    icon: MessagesSquareIcon,
    tagline: "Wspólna skrzynka wiadomości od klientów.",
    features: [
      "Wiadomości i dyskusje Allegro",
      "Messenger, Instagram i e-mail w jednym miejscu",
      "Przypisania do konsultantów, tagi i szablony odpowiedzi",
      "Podgląd zamówień kupującego obok rozmowy",
    ],
  },
}

export const ORDERS_PANEL: ModuleInfo = {
  key: "orders",
  name: "Zamówienia",
  href: "/orders",
  icon: PackageIcon,
  tagline: "Panel obsługi zamówień – w cenie modułu Live lub MultiChannel.",
  features: [
    "Zamówienia ze wszystkich źródeł na jednej liście",
    "Masowe etykiety InPost i faktury (Fakturownia, KSeF)",
    "Statusy i automatyczne akcje",
  ],
}

export const MODULE_ORDER: ModuleKey[] = ["live", "multichannel", "chat"]
