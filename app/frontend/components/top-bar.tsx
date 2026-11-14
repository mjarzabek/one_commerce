import { Link, router, usePage } from "@inertiajs/react";
import {
    BellIcon,
    LogOutIcon,
    MonitorIcon,
    MoonIcon,
    SearchIcon,
    SunIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const THEMES: { value: Theme; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: "Jasny", icon: SunIcon },
    { value: "dark", label: "Ciemny", icon: MoonIcon },
    { value: "system", label: "Systemowy", icon: MonitorIcon },
];

// Górny pasek: marka, wyszukiwarka (na razie atrapa), powiadomienia i menu użytkownika.
export function TopBar() {
    const { app, account, auth, modules } = usePage().props;
    const collapsed = useSidebar().state === "collapsed";
    const { theme, setTheme } = useTheme();

    return (
        <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-3 bg-sidebar text-sidebar-foreground px-3 md:gap-0 md:pr-0 md:pl-2.5">
            {/* Na desktopie lewa kolumna = szerokość sidebara (szerokiego lub zwiniętego do ikon), więc reszta paska
          pokrywa się z obszarem treści. Logo stoi nad ikonami menu. */}
            <div
                className={cn(
                    "flex flex-1 items-center gap-2 transition-[width] duration-200 ease-linear md:flex-none",
                    collapsed
                        ? "md:w-[calc(var(--sidebar-width-icon)-0.625rem)]"
                        : "md:w-[calc(var(--sidebar-width)-0.625rem)]",
                )}
            >
                <SidebarTrigger className="hover:bg-foreground/5 md:hidden" />
                <Link href="/" className="flex shrink-0 items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                        {app.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span
                        className={cn(
                            "truncate text-sm font-semibold max-sm:hidden",
                            collapsed && "md:hidden",
                        )}
                    >
                        {app.name}
                        {modules?.bundle === "one" && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                ONE
                            </span>
                        )}
                    </span>
                </Link>
            </div>

            <div className="contents md:flex md:flex-1 md:items-center md:gap-3">
                <div className="hidden flex-1 md:block" />
                <div className="flex w-full max-w-md min-w-0 shrink justify-center">
                    <button
                        type="button"
                        className="flex h-8 w-full max-w-md items-center gap-2 rounded-lg bg-card px-2.5 text-sm text-muted-foreground shadow-xs ring-1 ring-foreground/8 transition-colors hover:ring-foreground/15"
                    >
                        <SearchIcon className="size-4" />
                        <span className="flex-1 text-left">Szukaj</span>
                        <kbd className="rounded border px-1.5 font-sans text-[11px] text-muted-foreground max-sm:hidden">
                            ⌘ K
                        </kbd>
                    </button>
                </div>

                <div className="flex flex-1 items-center justify-end gap-1 md:pr-4">
                    <button
                        type="button"
                        aria-label="Powiadomienia"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    >
                        <BellIcon className="size-4" />
                    </button>
                    {auth && (
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 text-sm hover:bg-foreground/5">
                                <Avatar className="size-7 rounded-md">
                                    <AvatarFallback className="rounded-md bg-foreground/8 text-xs font-semibold text-foreground">
                                        {auth.user.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="max-w-40 truncate font-medium max-md:hidden">
                                    {account?.name}
                                </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="min-w-56"
                            >
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        <div className="text-foreground font-medium">
                                            {auth.user.name}
                                        </div>
                                        <div className="truncate text-xs font-normal">
                                            {auth.user.email_address}
                                        </div>
                                    </DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        {account?.name}
                                        {modules?.bundle === "one" && (
                                            <Badge
                                                variant="secondary"
                                                className="ml-2"
                                            >
                                                ONE
                                            </Badge>
                                        )}
                                    </DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Motyw</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup
                                        value={theme}
                                        onValueChange={(value) =>
                                            setTheme(value as Theme)
                                        }
                                    >
                                        {THEMES.map(
                                            ({ value, label, icon: Icon }) => (
                                                <DropdownMenuRadioItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    <Icon />
                                                    {label}
                                                </DropdownMenuRadioItem>
                                            ),
                                        )}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => router.delete("/session")}
                                >
                                    <LogOutIcon />
                                    Wyloguj
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    );
}
