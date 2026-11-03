import { createInertiaApp } from "@inertiajs/react"

import AppLayout from "@/layouts/app-layout"
import AuthLayout from "@/layouts/auth-layout"

void createInertiaApp({
  pages: "../pages",

  strictMode: true,

  // Ekrany logowania mają własny układ; reszta panelu dostaje menu boczne.
  layout: (name) => (name.startsWith("auth/") ? AuthLayout : AppLayout),

  title: (title) => {
    const appName = document.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.content ?? ""
    return title ? `${title} · ${appName}` : appName
  },

  progress: { color: "var(--primary)" },

  defaults: {
    form: {
      forceIndicesArrayFormatInFormData: false,
      withAllErrors: true,
    },
    visitOptions: () => ({ queryStringArrayFormat: "brackets" }),
  },
}).catch((error) => {
  if (document.getElementById("app")) throw error
  console.error("Brak elementu #app - ten entrypoint ładuj tylko na stronach Inertia.")
})
