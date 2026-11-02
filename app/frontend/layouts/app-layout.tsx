import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { FlashMessages } from "@/components/flash-messages"
import { PageBarProvider, PageBarSlot } from "@/components/page-bar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageBarProvider>
          <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-[env(safe-area-inset-top,0px)] z-10 flex h-12 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <PageBarSlot />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <FlashMessages />
            {children}
          </div>
        </PageBarProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
