import { Head, Link, usePage } from "@inertiajs/react";
import { CalendarIcon, LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    MODULE_ORDER,
    MODULES,
    ORDERS_PANEL,
    type ModuleInfo,
} from "@/lib/modules";
import { cn } from "@/lib/utils";

// DANE PRZYKŁADOWE - tylko do oceny wyglądu, do zastąpienia danymi z kontrolera.
const SAMPLE_STATS = [
    {
        label: "Zamówienia",
        value: "128",
        trend: [3, 5, 4, 6, 5, 8, 7, 9, 8, 11, 10, 12],
    },
    {
        label: "Sprzedaż",
        value: "24 870 zł",
        trend: [4, 4, 6, 5, 7, 6, 9, 8, 8, 10, 12, 11],
    },
    {
        label: "Średnia wartość",
        value: "194 zł",
        trend: [6, 7, 6, 6, 7, 8, 7, 7, 8, 7, 8, 8],
    },
    {
        label: "Zwroty",
        value: "3",
        trend: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    },
];

const SAMPLE_TASKS = { toShip: 4, unpaid: 2, messages: 3 };

const SAMPLE_SETUP = {
    done: 1,
    total: 4,
    next: "Podłącz pierwszy kanał sprzedaży",
    href: "/orders",
};

// Kolory ilustracji kart modułów.
const TINTS: Record<ModuleInfo["key"], string> = {
    orders: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    live: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    multichannel:
        "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    chat: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
};

function Sparkline({ points }: { points: number[] }) {
    const max = Math.max(...points, 1);
    const step = 48 / (points.length - 1);
    const coords = points
        .map(
            (p, i) =>
                `${(i * step).toFixed(1)},${(18 - (p / max) * 16).toFixed(1)}`,
        )
        .join(" ");

    return (
        <svg
            viewBox="0 0 48 20"
            className="h-5 w-12 shrink-0 text-sky-500"
            aria-hidden
        >
            <polyline
                points={coords}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

function StatsStrip() {
    return (
        <Card className="flex-row items-stretch gap-0 overflow-x-auto py-0">
            <div className="flex shrink-0 items-center px-3 py-3">
                <Button variant="ghost" size="sm" className="font-semibold">
                    <CalendarIcon />
                    Ostatnie 30 dni
                </Button>
            </div>
            {SAMPLE_STATS.map((stat) => (
                <div
                    key={stat.label}
                    className="flex min-w-36 flex-1 items-end justify-between gap-3 border-l px-4 py-3"
                >
                    <div>
                        <div className="text-muted-foreground text-xs font-medium">
                            {stat.label}
                        </div>
                        <div className="mt-0.5 text-base font-semibold tabular-nums">
                            {stat.value}
                        </div>
                    </div>
                    <Sparkline points={stat.trend} />
                </div>
            ))}
        </Card>
    );
}

function TaskChip({
    href,
    label,
    count,
}: {
    href: string;
    label: string;
    count: number;
}) {
    return (
        <Link
            href={href}
            className="bg-card ring-foreground/8 hover:bg-muted inline-flex h-8 items-center gap-2 rounded-full pr-1.5 pl-3.5 text-sm font-medium shadow-[0_1px_0_0_rgb(0_0_0/0.07)] ring-1 transition-colors"
        >
            {label}
            <span className="bg-muted min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums">
                {count}
            </span>
        </Link>
    );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
    const r = 7;
    const c = 2 * Math.PI * r;
    return (
        <svg viewBox="0 0 18 18" className="size-4.5 -rotate-90" aria-hidden>
            <circle
                cx="9"
                cy="9"
                r={r}
                fill="none"
                strokeWidth={2}
                className="stroke-muted"
            />
            <circle
                cx="9"
                cy="9"
                r={r}
                fill="none"
                strokeWidth={2}
                strokeDasharray={`${(value / total) * c} ${c}`}
                strokeLinecap="round"
                className="stroke-foreground"
            />
        </svg>
    );
}

function SetupCard() {
    return (
        <Card className="gap-1 px-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                <ProgressRing
                    value={SAMPLE_SETUP.done}
                    total={SAMPLE_SETUP.total}
                />
                {SAMPLE_SETUP.done} z {SAMPLE_SETUP.total} zadań ukończonych
            </div>
            <h3 className="mt-2 text-base font-semibold">
                Skonfiguruj swoje konto
            </h3>
            <p className="text-muted-foreground">
                Następny krok: {SAMPLE_SETUP.next}
            </p>
            <div className="mt-auto pt-4">
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    render={<Link href={SAMPLE_SETUP.href} />}
                >
                    Kontynuuj
                </Button>
            </div>
        </Card>
    );
}

function ModuleCard({ info, enabled }: { info: ModuleInfo; enabled: boolean }) {
    const Icon = info.icon;

    return (
        <Card className="relative min-h-52 gap-1 px-4">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                {enabled ? (
                    <>
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Aktywny
                    </>
                ) : (
                    <>
                        <LockIcon className="size-3" />
                        Dostępny w pakiecie
                    </>
                )}
            </div>
            <h3 className="mt-2 text-base font-semibold">{info.name}</h3>
            <p className="text-muted-foreground max-w-[65%]">{info.tagline}</p>

            <div
                aria-hidden
                className={cn(
                    "absolute -right-6 -bottom-6 flex size-36 rotate-[-8deg] items-center justify-center rounded-3xl",
                    TINTS[info.key],
                    !enabled && "opacity-60 grayscale",
                )}
            >
                <Icon className="size-14" strokeWidth={1.5} />
            </div>

            <div className="relative mt-auto pt-6">
                <Button
                    variant={enabled ? "default" : "outline"}
                    size="sm"
                    className={enabled ? undefined : "bg-card"}
                    render={<Link href={info.href} />}
                >
                    {enabled ? "Otwórz" : "Zobacz ofertę"}
                </Button>
            </div>
        </Card>
    );
}

export default function Dashboard() {
    const { auth, account, modules } = usePage().props;
    const enabled = modules?.enabled ?? [];
    const firstName = auth?.user.name.split(" ")[0];

    return (
        <>
            <Head title="Strona główna" />
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <StatsStrip />

                <section className="relative py-10 text-center md:py-14">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,var(--card),transparent_65%)] opacity-90 dark:opacity-60"
                    />
                    <div className="relative">
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                            Dzień dobry, {firstName}!
                        </h1>
                        <p className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                            Rozwijajmy dalej {account?.name ?? "Twój biznes"}.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {modules?.ordersPanel && (
                                <>
                                    <TaskChip
                                        href="/orders"
                                        label="Do wysłania"
                                        count={SAMPLE_TASKS.toShip}
                                    />
                                    <TaskChip
                                        href="/orders"
                                        label="Nieopłacone"
                                        count={SAMPLE_TASKS.unpaid}
                                    />
                                </>
                            )}
                            {enabled.includes("chat") && (
                                <TaskChip
                                    href="/chat"
                                    label="Nowe wiadomości"
                                    count={SAMPLE_TASKS.messages}
                                />
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                    <SetupCard />
                    <ModuleCard
                        info={ORDERS_PANEL}
                        enabled={!!modules?.ordersPanel}
                    />
                    {MODULE_ORDER.map((key) => (
                        <ModuleCard
                            key={key}
                            info={MODULES[key]}
                            enabled={enabled.includes(key)}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
