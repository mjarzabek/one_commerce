import { Head, router } from "@inertiajs/react";
import { ChevronDownIcon, PackageIcon, TagIcon } from "lucide-react";
import { useMemo } from "react";

import { BulkActionBar } from "@/components/data-table/bulk-action-bar";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/data-table/empty-state";
import type { PaginationState } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import type { FilterSchema, FilterValues } from "@/components/data-table/types";
import { useServerTable } from "@/components/data-table/use-server-table";
import { orderColumns, type OrderRow } from "@/components/orders/columns";
import { StatusMenuItems } from "@/components/orders/status-menu";
import {
    StatusSelect,
    StatusSidebar,
    type StatusSelection,
} from "@/components/orders/status-sidebar";
import { ordersWord, type StatusTree } from "@/components/orders/types";
import { PageBar } from "@/components/page-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { plural } from "@/lib/plural";

type View = {
    q: string;
    status: number | null;
    group: number | null;
    sort: string;
    dir: "asc" | "desc";
    per: number;
};

type Props = {
    // Przy wejściu na listę serwer dosyła je osobnym zapytaniem (deferred) - do tego czasu tabela ma skeleton.
    orders?: OrderRow[];
    pagination?: PaginationState;
    statusTree: StatusTree;
    totalCount: number;
    filterSchema: FilterSchema[];
    filters: FilterValues;
    view: View;
    listQuery: string;
};

const rowId = (row: OrderRow) => row.id;
const noun = (count: number) => plural(count, ordersWord);

export default function OrdersIndex({
    orders,
    pagination,
    statusTree,
    totalCount,
    filterSchema,
    filters,
    view,
    listQuery,
}: Props) {
    const columns = useMemo(() => orderColumns(listQuery), [listQuery]);
    const table = useServerTable({
        url: "/orders",
        view,
        pagination,
        filterSchema,
        filters,
    });
    const { selection } = table;

    const rows = orders ?? [];
    const total = pagination?.total ?? 0;
    const pageIds = rows.map((order) => order.id);
    const pageSelected =
        pageIds.length > 0 && pageIds.every(selection.isSelected);
    const selectedCount = selection.count(total);

    const selected: StatusSelection = {
        status: view.status,
        group: view.group,
    };
    const select = (next: StatusSelection) => table.visit(next);

    const changeStatus = (statusId: number) =>
        router.post(
            "/orders/bulk",
            table.bulkParams({
                operation: "status",
                status_id: String(statusId),
            }),
            {
                preserveScroll: true,
                onSuccess: () => selection.clear(),
            },
        );

    return (
        <>
            <Head title="Zamówienia" />
            <PageBar
                breadcrumbs={[{ label: "Zamówienia" }]}
                actions={<Button disabled>Nowe zamówienie</Button>}
            />

            <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
                <aside className="hidden lg:block">
                    <div className="sticky top-4">
                        <StatusSidebar
                            tree={statusTree}
                            total={totalCount}
                            value={selected}
                            onChange={select}
                        />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-col gap-3">
                    <div className="lg:hidden">
                        <StatusSelect
                            tree={statusTree}
                            total={totalCount}
                            value={selected}
                            onChange={select}
                        />
                    </div>

                    <Card className="gap-0 py-0">
                        <DataTableToolbar
                            id="orders"
                            server={table}
                            searchLabel="Szukaj po numerze, kliencie, e-mailu lub telefonie"
                        />

                        <DataTable<OrderRow>
                            data={rows}
                            loading={!orders}
                            columns={columns}
                            rowId={rowId}
                            server={table}
                            selectable
                            rowLabel={(row) => `zamówienie ${row.number}`}
                            noun={noun}
                            className="min-w-[860px]"
                            empty={
                                table.filtered ? (
                                    <EmptyState
                                        icon={PackageIcon}
                                        title="Brak zamówień spełniających kryteria"
                                        action={
                                            <Button
                                                variant="outline"
                                                onClick={table.clearAll}
                                            >
                                                Wyczyść wyszukiwanie i filtry
                                            </Button>
                                        }
                                    />
                                ) : view.status || view.group ? (
                                    <EmptyState
                                        icon={PackageIcon}
                                        title="Brak zamówień w tym statusie"
                                    />
                                ) : (
                                    <EmptyState
                                        icon={PackageIcon}
                                        title="Brak zamówień"
                                        description="Pojawią się tu zamówienia z podłączonych kanałów i z transmisji live."
                                    />
                                )
                            }
                        />
                    </Card>
                </div>
            </div>

            {/* Miejsce na pasek akcji, żeby nie zasłaniał ostatniego wiersza. */}
            {selectedCount > 0 && <div className="h-16" aria-hidden />}

            <BulkActionBar
                count={selectedCount}
                onClear={selection.clear}
                total={total}
                pageSelected={pageSelected}
                onPage={(value) => selection.setPage(pageIds, value)}
                onAll={selection.selectAll}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button variant="outline">
                                <TagIcon />
                                Zmień status
                                <ChevronDownIcon data-icon="inline-end" />
                            </Button>
                        }
                    />
                    <DropdownMenuContent
                        side="top"
                        align="start"
                        className="min-w-52"
                    >
                        <StatusMenuItems
                            tree={statusTree}
                            onSelect={(status) => changeStatus(status.id)}
                        />
                    </DropdownMenuContent>
                </DropdownMenu>
            </BulkActionBar>
        </>
    );
}
