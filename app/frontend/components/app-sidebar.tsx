import { Link, router, usePage } from "@inertiajs/react"
import { ChevronsUpDownIcon, LayoutDashboardIcon, LockIcon, LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MODULE_ORDER, MODULES, ORDERS_PANEL, type ModuleInfo } from "@/lib/modules"

function isActive(currentUrl: string, href: string) {
  if (href === "/") return currentUrl === "/"
  return currentUrl === href || currentUrl.startsWith(`${href}/`) || currentUrl.startsWith(`${href}?`)
}

function NavItem({ item, locked }: { item: ModuleInfo; locked: boolean }) {
  const { url } = usePage()
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive(url, item.href)}
        tooltip={item.name}
        render={<Link href={item.href} />}
        className={locked ? "text-muted-foreground" : undefined}
      >
        <Icon />
        <span>{item.name}</span>
      </SidebarMenuButton>
      {locked && (
        <SidebarMenuBadge>
          <LockIcon className="size-3.5" aria-label="Moduł niedostępny" />
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { app, account, auth, modules } = usePage().props
  const { url } = usePage()
  const enabled = modules?.enabled ?? []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-semibold">
                {app.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {app.name}
                  {modules?.bundle === "one" && <span className="text-muted-foreground font-normal"> ONE</span>}
                </span>
                <span className="text-muted-foreground truncate text-xs">{account?.name}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={isActive(url, "/")} tooltip="Pulpit" render={<Link href="/" />}>
                <LayoutDashboardIcon />
                <span>Pulpit</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <NavItem item={ORDERS_PANEL} locked={!modules?.ordersPanel} />
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Moduły</SidebarGroupLabel>
          <SidebarMenu>
            {MODULE_ORDER.map((key) => (
              <NavItem key={key} item={MODULES[key]} locked={!enabled.includes(key)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {auth && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{auth.user.initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{auth.user.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{auth.user.email_address}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {account?.name}
                      {modules?.bundle === "one" && (
                        <Badge variant="secondary" className="ml-2">
                          ONE
                        </Badge>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.delete("/session")}>
                    <LogOutIcon />
                    Wyloguj
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
