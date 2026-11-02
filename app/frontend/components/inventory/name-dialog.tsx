import { useForm } from "@inertiajs/react"
import { useEffect, useState, type ReactElement, type ReactNode } from "react"

import { errorText, type FormErrors } from "@/components/inventory/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Values = Record<string, string | string[] | boolean>

// Okno z formularzem nazwy (+ opcjonalne dodatkowe pola) dla katalogów, magazynów, grup.
// Okno można otwierać przyciskiem (`trigger`) albo z zewnątrz (`open` / `onOpenChange`, np. z menu „⋯”).
export function NameDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  action,
  method = "post",
  initial,
  submitLabel = "Zapisz",
  children,
}: {
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  action: string
  method?: "post" | "patch"
  initial: Values & { name: string }
  submitLabel?: string
  children?: (form: { data: Values; setData: (key: string, value: Values[string]) => void; errors: FormErrors }) => ReactNode
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setInnerOpen(next))
  const form = useForm<Values>(initial)
  const errors = form.errors as FormErrors

  // Przy każdym otwarciu formularz startuje od wartości początkowych.
  useEffect(() => {
    if (!open) return
    form.setData(initial)
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.submit(method, action, {
      preserveScroll: true,
      preserveState: "errors",
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errorText(errors, "name")}>
              <FieldLabel htmlFor="dialog-name">Nazwa</FieldLabel>
              <Input
                id="dialog-name"
                value={String(form.data.name ?? "")}
                onChange={(e) => form.setData("name", e.target.value)}
                aria-invalid={!!errorText(errors, "name")}
                autoFocus
              />
              <FieldError>{errorText(errors, "name")}</FieldError>
            </Field>
            {children?.({ data: form.data, setData: (key, value) => form.setData(key, value), errors })}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Zapisywanie…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
