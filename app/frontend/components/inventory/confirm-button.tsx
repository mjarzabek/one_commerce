import { router } from "@inertiajs/react"
import { Trash2Icon, type LucideIcon } from "lucide-react"
import { useState, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

type ConfirmProps = {
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmIcon?: LucideIcon
  destructive?: boolean
  // Żądanie do wysłania po potwierdzeniu albo własna akcja.
  method?: "post" | "delete"
  url?: string
  onConfirm?: () => void
}

// Akcja z potwierdzeniem w oknie (bez systemowego confirm()).
export function ConfirmAction({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmIcon: Icon,
  destructive,
  method = "post",
  url,
  onConfirm,
}: ConfirmProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setInnerOpen(next))
  const [processing, setProcessing] = useState(false)

  const confirm = () => {
    if (onConfirm) {
      onConfirm()
      setOpen(false)
      return
    }
    router.visit(url!, {
      method,
      preserveScroll: true,
      onStart: () => setProcessing(true),
      onFinish: () => {
        setProcessing(false)
        setOpen(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Anuluj</Button>} />
          <Button variant={destructive ? "destructive" : "default"} disabled={processing} onClick={confirm}>
            {Icon && <Icon />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Usuwanie z potwierdzeniem: DELETE na `url` albo własna akcja `onConfirm`.
export function ConfirmDelete(props: Omit<ConfirmProps, "confirmLabel" | "destructive" | "method">) {
  return <ConfirmAction {...props} method="delete" confirmLabel="Usuń" confirmIcon={Trash2Icon} destructive />
}
