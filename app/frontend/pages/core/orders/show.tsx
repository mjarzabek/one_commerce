import { Head, Link, useForm } from "@inertiajs/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode } from "react";

import { formatDate } from "@/components/inventory/types";
import {
    AddressCard,
    CustomFieldsSection,
    DocumentsSection,
    InfoSection,
    PanelSection,
    type AddressKind,
} from "@/components/orders/order-blocks";
import {
    PaymentSection,
    ShippingSection,
    StatusSection,
    ValueSection,
    type StockState,
} from "@/components/orders/order-info";
import { ItemsCard, type OrderItem } from "@/components/orders/items-card";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import type {
    Address,
    Customer,
    CustomFieldDefinition,
    OrderStatus,
    Payment,
    StatusTree,
} from "@/components/orders/types";
import { PageBar } from "@/components/page-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type HistoryEntry = {
    id: number;
    created_at: string;
    user: string | null;
    note: string | null;
    from: Pick<OrderStatus, "name" | "color"> | null;
    to: Pick<OrderStatus, "name" | "color">;
};

type Order = {
    id: number;
    number: string;
    placed_at: string;
    status_since: string;
    source: string;
    source_channel: string | null;
    external_id: string | null;
    warehouse: string | null;
    stock: StockState | null;
    status: OrderStatus;
    payment: Payment;
    customer: Customer;
    shipping_method: string | null;
    addresses: Record<AddressKind, Address>;
    wants_invoice: boolean;
    custom_fields: Record<string, string | boolean>;
    notes: string;
    customer_message: string | null;
    totals: {
        subtotal: string;
        shipping: string;
        total: string;
        quantity: number;
        shippingInput: string;
    };
    items: OrderItem[];
    history: HistoryEntry[];
};

type Navigation = {
    list: string;
    previous: string | null;
    next: string | null;
};

type Props = {
    order: Order;
    statusTree: StatusTree;
    navigation: Navigation;
    customFields: CustomFieldDefinition[];
    shippingMethods: string[];
};

export default function OrderShow({
    order,
    statusTree,
    navigation,
    customFields,
    shippingMethods,
}: Props) {
    return (
        <>
            <Head title={`Zamówienie ${order.number}`} />
            <PageBar
                breadcrumbs={[
                    { label: "Zamówienia", href: navigation.list },
                    { label: <OrderTitle order={order} /> },
                ]}
                actions={<OrderNavigation navigation={navigation} />}
            />

            <div className="flex flex-col gap-4">
                <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
                    <OrderInfoPanel order={order} customFields={customFields} />

                    <div className="flex min-w-0 flex-col gap-4">
                        <OrderBar
                            order={order}
                            statusTree={statusTree}
                            shippingMethods={shippingMethods}
                        />
                        <ItemsCard
                            orderId={order.id}
                            items={order.items}
                            stockLocked={
                                order.stock?.state === "deducted" ||
                                order.stock?.state === "returned"
                            }
                        />
                        {/* Dostawa, faktura i punkt odbioru obok siebie, gdy jest miejsce. */}
                        <div className="@container">
                            <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
                                <AddressCard
                                    orderId={order.id}
                                    kind="shipping"
                                    address={order.addresses.shipping}
                                />
                                <AddressCard
                                    orderId={order.id}
                                    kind="billing"
                                    address={order.addresses.billing}
                                    wantsInvoice={order.wants_invoice}
                                />
                                <AddressCard
                                    orderId={order.id}
                                    kind="pickup"
                                    address={order.addresses.pickup}
                                />
                            </div>
                        </div>
                        <HistoryCard history={order.history} />
                    </div>
                </div>
            </div>
        </>
    );
}

function OrderTitle({ order }: { order: Order }) {
    return (
        <>
            {order.number}
            {order.customer.name && (
                <span className="text-muted-foreground ml-3 font-normal">
                    {order.customer.name}
                </span>
            )}
        </>
    );
}

// Poprzednie / następne zamówienie na liście, z której przyszliśmy.
function OrderNavigation({ navigation }: { navigation: Navigation }) {
    const arrow = (href: string | null, label: string, icon: ReactNode) =>
        href ? (
            <Link
                href={href}
                className={buttonVariants({ variant: "outline", size: "icon" })}
                aria-label={label}
                title={label}
            >
                {icon}
            </Link>
        ) : (
            <Button variant="outline" size="icon" disabled aria-label={label}>
                {icon}
            </Button>
        );

    return (
        <div className="flex gap-1">
            {arrow(
                navigation.previous,
                "Poprzednie zamówienie",
                <ChevronLeftIcon />,
            )}
            {arrow(
                navigation.next,
                "Następne zamówienie",
                <ChevronRightIcon />,
            )}
        </div>
    );
}

// Pasek nad produktami: status, płatność, dostawa i wartość. Linie między sekcjami to tło prześwitujące
// przez odstęp 1px (działa przy każdej liczbie kolumn).
function OrderBar({
    order,
    statusTree,
    shippingMethods,
}: {
    order: Order;
    statusTree: StatusTree;
    shippingMethods: string[];
}) {
    return (
        <Card className="@container gap-0 overflow-hidden py-0">
            <div className="bg-border grid gap-px @2xl:grid-cols-2 @5xl:grid-cols-4 [&>section]:bg-card">
                <StatusSection
                    orderId={order.id}
                    status={order.status}
                    since={order.status_since}
                    placedAt={order.placed_at}
                    stock={order.stock}
                    warehouse={order.warehouse}
                    statusTree={statusTree}
                />
                <PaymentSection orderId={order.id} payment={order.payment} />
                <ShippingSection
                    orderId={order.id}
                    method={order.shipping_method}
                    price={order.totals.shipping}
                    priceInput={order.totals.shippingInput}
                    suggestions={shippingMethods}
                />
                <ValueSection
                    subtotal={order.totals.subtotal}
                    shipping={order.totals.shipping}
                    total={order.totals.total}
                    quantity={order.totals.quantity}
                />
            </div>
        </Card>
    );
}

// Boks po lewej: informacje (klient, źródło), dokumenty, wiadomość klienta, notatka i pola dodatkowe.
function OrderInfoPanel({
    order,
    customFields,
}: {
    order: Order;
    customFields: CustomFieldDefinition[];
}) {
    return (
        <Card className="gap-0 divide-y py-0">
            <InfoSection
                orderId={order.id}
                customer={order.customer}
                source={[order.source, order.source_channel]
                    .filter(Boolean)
                    .join(" · ")}
                externalId={order.external_id}
            />
            <DocumentsSection wantsInvoice={order.wants_invoice} />
            {order.customer_message && (
                <PanelSection title="Wiadomość od klienta">
                    <p className="text-sm whitespace-pre-line">
                        {order.customer_message}
                    </p>
                </PanelSection>
            )}
            <NotesSection order={order} />
            <CustomFieldsSection
                orderId={order.id}
                fields={customFields}
                values={order.custom_fields}
            />
        </Card>
    );
}

function NotesSection({ order }: { order: Order }) {
    const form = useForm({ notes: order.notes });
    const save = (event: React.FormEvent) => {
        event.preventDefault();
        form.patch(`/orders/${order.id}`, {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <PanelSection title={<label htmlFor="order-notes">Notatka</label>}>
            <form onSubmit={save} className="flex flex-col gap-2">
                <Textarea
                    id="order-notes"
                    value={form.data.notes}
                    onChange={(e) => form.setData("notes", e.target.value)}
                    rows={3}
                    placeholder="Widoczna tylko w panelu"
                />
                {form.isDirty && (
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => form.reset()}
                        >
                            Anuluj
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Zapisz
                        </Button>
                    </div>
                )}
            </form>
        </PanelSection>
    );
}

// Historia statusów: od najnowszej zmiany, z autorem i notatką.
function HistoryCard({ history }: { history: HistoryEntry[] }) {
    // Wpisy bez zmiany statusu (np. z migracji „Opłacone” → status + płatność) pomijamy.
    const visible = history.filter(
        (entry) => entry.from?.name !== entry.to.name,
    );
    return (
        <Card>
            <CardHeader>
                <CardTitle>Historia</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="flex flex-col">
                    {visible.map((entry, index) => (
                        <li
                            key={entry.id}
                            className="relative flex gap-3 pb-4 last:pb-0"
                        >
                            {index < visible.length - 1 && (
                                <span
                                    className="bg-border absolute top-4 bottom-0 left-[3px] w-px"
                                    aria-hidden
                                />
                            )}
                            <span
                                className="bg-muted-foreground/40 mt-1.5 size-[7px] shrink-0 rounded-full"
                                aria-hidden
                            />
                            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
                                <div className="flex flex-wrap items-center gap-x-2">
                                    {entry.from ? (
                                        <>
                                            <span className="text-muted-foreground">
                                                Status
                                            </span>
                                            <OrderStatusBadge
                                                name={entry.from.name}
                                                color={entry.from.color}
                                                className="text-muted-foreground"
                                            />
                                            <span className="text-muted-foreground">
                                                →
                                            </span>
                                            <OrderStatusBadge
                                                name={entry.to.name}
                                                color={entry.to.color}
                                                className="font-medium"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span>Złożono zamówienie</span>
                                            <OrderStatusBadge
                                                name={entry.to.name}
                                                color={entry.to.color}
                                                className="font-medium"
                                            />
                                        </>
                                    )}
                                </div>
                                <span className="text-muted-foreground text-xs whitespace-nowrap">
                                    {[entry.user, formatDate(entry.created_at)]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </span>
                                {entry.note && (
                                    <p className="text-muted-foreground w-full">
                                        {entry.note}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
