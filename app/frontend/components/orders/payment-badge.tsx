import type { Payment } from "@/components/orders/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Kolor i nazwa stanu płatności - wspólne dla listy i karty zamówienia. Pobranie bez wpłaty to osobny stan
// („Pobranie”), bo klient zapłaci kurierowi.
export function paymentTone(payment: Payment) {
  if (payment.cod) return { label: "Pobranie", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" }
  switch (payment.status) {
    case "paid":
      return { label: payment.label, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }
    case "partial":
      return { label: payment.label, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }
    case "overpaid":
      return { label: payment.label, className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" }
    default:
      return { label: payment.label, className: "bg-muted text-muted-foreground" }
  }
}

export function PaymentBadge({ payment }: { payment: Payment }) {
  const tone = paymentTone(payment)
  return <Badge className={cn("border-transparent", tone.className)}>{tone.label}</Badge>
}

// Kwota wpłacona w kolorze stanu płatności (jak „Zapłacono X z Y”).
export function PaidAmountBadge({ payment }: { payment: Payment }) {
  const tone = paymentTone(payment)
  return (
    <span className={cn("inline-flex h-7 items-center rounded-md px-2 font-semibold tabular-nums", tone.className)} title={tone.label}>
      {payment.paid}
    </span>
  )
}
