import { CircleAlertIcon, CircleCheckIcon, InfoIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useTheme } from "@/hooks/use-theme"

// Kolorowe toasty: tło i ramka to odcień barwy zmieszany z tłem popovera, tekst - z jego tekstem,
// więc ta sama definicja daje czytelny wynik w jasnym i ciemnym motywie.
const tone = (name: string, color: string) => ({
  [`--${name}-bg`]: `color-mix(in oklab, ${color} 12%, var(--popover))`,
  [`--${name}-border`]: `color-mix(in oklab, ${color} 40%, var(--popover))`,
  [`--${name}-text`]: `color-mix(in oklab, ${color} 70%, var(--popover-foreground))`,
})

function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()

  return (
    <Sonner
      theme={resolved}
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleAlertIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          ...tone("success", "oklch(0.696 0.17 162.48)"),
          ...tone("warning", "oklch(0.769 0.188 70.08)"),
          ...tone("error", "var(--destructive)"),
          ...tone("info", "oklch(0.623 0.214 259.815)"),
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
