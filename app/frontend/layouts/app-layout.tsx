import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { FlashMessages } from "@/components/flash-messages"
import { PageBarProvider, PageBarSlot } from "@/components/page-bar"
import { TopBar } from "@/components/top-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Powłoka: górny pasek i sidebar stoją w miejscu, przewija się tylko obszar treści (zaokrąglony róg zostaje widoczny).
// `scroll-region` – Inertia zapamiętuje i resetuje przewinięcie tego elementu przy nawigacji.
// Stan menu (szerokie / zwinięte) zapisuje sidebar w ciasteczku `sidebar_state` – odtwarzamy go po przeładowaniu.
const sidebarOpenFromCookie = () => !document.cookie.split("; ").includes("sidebar_state=false")

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={sidebarOpenFromCookie()} className="bg-sidebar flex h-svh flex-col overflow-hidden [--header-height:3.5rem]">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <SidebarInset
          scroll-region=""
          className="bg-canvas min-w-0 overflow-y-auto md:rounded-tl-xl md:border-t md:border-l md:border-foreground/6"
        >
          <PageBarProvider>
            <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
              <PageBarSlot />
              <FlashMessages />
              {children}
            </div>
          </PageBarProvider>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
