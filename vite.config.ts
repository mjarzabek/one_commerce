import inertia from "@inertiajs/vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"
import RubyPlugin from "vite-plugin-ruby"

export default defineConfig({
  plugins: [tailwindcss(), RubyPlugin(), inertia(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "app/frontend"),
    },
  },
})
