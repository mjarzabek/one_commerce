export type ModuleKey = "live" | "multichannel" | "chat"

export type FlashData = {
  notice?: string
  warning?: string
  alert?: string
}

export type CurrentUser = {
  id: number
  name: string
  email_address: string
  initials: string
}

export type SharedProps = {
  app: { name: string }
  auth?: { user: CurrentUser }
  account?: { id: number; name: string } | null
  modules?: {
    enabled: ModuleKey[]
    ordersPanel: boolean
    bundle: "one" | null
  }
}
