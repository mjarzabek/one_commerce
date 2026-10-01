import { Form, Head, usePage } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function Login() {
  const { app } = usePage().props

  return (
    <>
      <Head title="Logowanie" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Zaloguj się do {app.name}</CardTitle>
          <CardDescription>Wpisz e-mail i hasło do swojego konta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form action="/session" method="post" resetOnError={["password"]}>
            {({ errors, processing }) => (
              <FieldGroup>
                <Field data-invalid={!!errors.email_address}>
                  <FieldLabel htmlFor="email_address">E-mail</FieldLabel>
                  <Input
                    id="email_address"
                    name="email_address"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
                    aria-invalid={!!errors.email_address}
                  />
                  <FieldError>{errors.email_address}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Hasło</FieldLabel>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </Field>
                <Button type="submit" disabled={processing} className="w-full">
                  {processing ? "Logowanie…" : "Zaloguj się"}
                </Button>
              </FieldGroup>
            )}
          </Form>
        </CardContent>
      </Card>
    </>
  )
}
