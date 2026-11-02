import { Link, usePage } from "@inertiajs/react"
import { ChevronRightIcon, HomeIcon, LockIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { CORE_NAV, MODULE_ORDER, MODULES, type NavLink } from "@/lib/modules"
import { cn } from "@/lib/utils"

// Pozycja w stylu Shopify: niska, aktywna na białym tle z cieniem.
const ITEM_CLASS = "h-8 text-sm font-medium data-active:bg-card data-active:shadow-xs"

function isActive(currentUrl: string, href: string) {
  if (href === "/") return currentUrl === "/"
  return currentUrl === href || currentUrl.startsWith(`${href}/`) || currentUrl.startsWith(`${href}?`)
}

// Pozycja z podpozycjami: przycisk prowadzi do sekcji, strzałka rozwija listę (otwiera się po wejściu do sekcji i zwija po wyjściu z niej).
// W menu zwiniętym do ikon podpozycje są ukryte, zostaje sam link.
function NavGroup({ item }: { item: NavLink & { items: NonNullable<NavLink["items"]> } }) {
  const { url } = usePage()
  const active = isActive(url, item.href)
  const [open, setOpen] = useState(active)
  const Icon = item.icon

  useEffect(() => {
    setOpen(active)
  }, [active])

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      {/* Rodzic aktywnej sekcji bez białego tła – podświetlona jest tylko aktywna podpozycja. */}
      <SidebarMenuButton
        isActive={active}
        tooltip={item.name}
        render={<Link href={item.href} />}
        className={cn(ITEM_CLASS, "data-active:bg-transparent data-active:font-semibold data-active:shadow-none data-active:hover:bg-sidebar-accent")}
      >
        <Icon />
        <span>{item.name}</span>
      </SidebarMenuButton>
      <CollapsibleTrigger
        render={<SidebarMenuAction />}
        className="text-muted-foreground opacity-0 transition group-hover/menu-item:opacity-100 focus-visible:opacity-100 data-panel-open:rotate-90"
        aria-label={open ? `Zwiń: ${item.name}` : `Rozwiń: ${item.name}`}
      >
        <ChevronRightIcon />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mx-0 ml-4 translate-x-0 gap-0.5 border-foreground/10 pr-0 pl-1.5">
          {item.items.map((sub) => (
            <SidebarMenuSubItem key={sub.href}>
              <SidebarMenuSubButton
                isActive={isActive(url, sub.href) && (sub.match?.(url) ?? true)}
                render={<Link href={sub.href} />}
                className="text-muted-foreground hover:text-foreground data-active:text-foreground h-8 translate-x-0 text-sm font-medium data-active:bg-card data-active:shadow-xs"
              >
                <span>{sub.name}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

function NavItem({ item, locked }: { item: NavLink; locked: boolean }) {
  const { url } = usePage()
  const Icon = item.icon

  if (item.items && !locked) return <NavGroup item={{ ...item, items: item.items }} />

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive(url, item.href)}
        tooltip={item.name}
        render={<Link href={item.href} />}
        className={cn(ITEM_CLASS, locked && "text-muted-foreground")}
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

// Przełącznik szerokie / wąskie menu (tylko desktop; skrót Ctrl/⌘+B).
function CollapseToggle() {
  const { state, toggleSidebar, isMobile } = useSidebar()
  if (isMobile) return null
  const collapsed = state === "collapsed"
  const Icon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={collapsed ? "Rozwiń menu" : undefined}
          onClick={toggleSidebar}
          className={cn(ITEM_CLASS, "text-muted-foreground hover:text-foreground")}
        >
          <Icon />
          <span>Zwiń menu</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { modules } = usePage().props
  const { url } = usePage()
  const enabled = modules?.enabled ?? []

  return (
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]! group-data-[side=left]:border-r-0"
    >
      <SidebarContent className="pt-1">
        <SidebarGroup className="py-1">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isActive(url, "/")}
                tooltip="Strona główna"
                render={<Link href="/" />}
                className={ITEM_CLASS}
              >
                <HomeIcon />
                <span>Strona główna</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {CORE_NAV.map((item) => (
              <NavItem key={item.href} item={item} locked={!modules?.ordersPanel} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="h-8 text-[13px] font-semibold text-sidebar-foreground/70">Moduły</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {MODULE_ORDER.map((key) => (
              <NavItem key={key} item={MODULES[key]} locked={!enabled.includes(key)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <CollapseToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
