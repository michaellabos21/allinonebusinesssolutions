"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Handshake,
  Pencil,
  Plus,
  SearchX,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { DealStageBadge } from "@/components/common/status-badge";
import {
  FilterMenu,
  SearchInput,
  SegmentedControl,
  TableToolbar,
} from "@/components/common/table-toolbar";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, formatMoney } from "@/lib/format";
import { getOpenDeals } from "@/lib/metrics";
import { memberName } from "@/lib/runtime";
import { useFocusReturn } from "@/lib/use-focus-return";
import { DEAL_STAGES, type Deal, type DealStage, OPEN_DEAL_STAGES } from "@/mocks";

type View = "board" | "table";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
  { value: "archived", label: "Archived" },
];

const stageLabel = (stage: DealStage) =>
  DEAL_STAGES.find((item) => item.id === stage)?.label ?? stage;
const sumValue = (deals: Deal[]) => deals.reduce((total, deal) => total + deal.valueMinor, 0);

export function DealsScreen() {
  const store = useDemoStore();
  const { deals, companyName, openQuickCreate, openEditor, moveDeal, setDealArchived } = store;
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Deal | null>(null);
  const stageSelectId = useId();
  const ownerOptions = [
    { value: "all", label: "Anyone" },
    ...store.team.map((member) => ({ value: member.id, label: member.name })),
  ];

  const selected = deals.find((deal) => deal.id === selectedId) ?? null;
  const returnFocus = useFocusReturn(selected !== null);
  const openTotal = getOpenDeals(deals);

  /** Search and owner apply to both views; status only narrows the table. */
  const matching = useMemo(() => {
    const text = query.trim().toLowerCase();
    return deals.filter((deal) => {
      if (owner !== "all" && deal.ownerId !== owner) return false;
      if (!text) return true;
      return [deal.name, companyName(deal.companyId)].some((value) =>
        value.toLowerCase().includes(text),
      );
    });
  }, [deals, companyName, query, owner]);

  const boardDeals = getOpenDeals(matching);
  const tableDeals = useMemo(() => {
    if (status === "archived") return matching.filter((deal) => deal.archived);
    const live = matching.filter((deal) => !deal.archived);
    if (status === "all") return live;
    if (status === "open") return getOpenDeals(live);
    return live.filter((deal) => deal.stage === status);
  }, [matching, status]);

  function changeStage(deal: Deal, stage: DealStage) {
    if (deal.stage === stage) return;
    const previous = deal.stage;
    moveDeal(deal.id, stage);
    toast.success(`“${deal.name}” moved to ${stageLabel(stage)}`, {
      action: { label: "Undo", onClick: () => moveDeal(deal.id, previous) },
    });
  }

  function dealActions(deal: Deal) {
    return [
      { label: "Edit", icon: Pencil, onSelect: () => openEditor("deal", deal.id) },
      deal.archived
        ? {
            label: "Restore",
            icon: ArchiveRestore,
            onSelect: () => {
              setDealArchived(deal.id, false);
              toast.success(`“${deal.name}” restored`);
            },
          }
        : {
            label: "Archive",
            icon: Archive,
            destructive: true,
            onSelect: () => setArchiveTarget(deal),
          },
    ];
  }

  const columns = useMemo<Column<Deal>[]>(
    () => [
      {
        id: "name",
        header: "Deal",
        sortValue: (deal) => deal.name,
        cell: (deal) => (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setSelectedId(deal.id)}
              className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {deal.name}
            </button>
            <Link
              href={`/crm/companies/${deal.companyId}`}
              className="block truncate text-caption text-muted-foreground hover:text-foreground hover:underline"
            >
              {companyName(deal.companyId)}
            </Link>
          </div>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        sortValue: (deal) => DEAL_STAGES.findIndex((stage) => stage.id === deal.stage),
        cell: (deal) => <DealStageBadge stage={deal.stage} archived={deal.archived} />,
      },
      {
        id: "value",
        header: "Value",
        align: "right",
        sortValue: (deal) => deal.valueMinor,
        cell: (deal) => formatMoney(deal.valueMinor),
      },
      {
        id: "owner",
        header: "Owner",
        sortValue: (deal) => memberName(deal.ownerId),
        className: "hidden md:table-cell",
        cell: (deal) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <UserAvatar name={memberName(deal.ownerId)} className="size-6" />
            {memberName(deal.ownerId)}
          </span>
        ),
      },
      {
        id: "close",
        header: "Expected close",
        sortValue: (deal) => deal.expectedCloseOn,
        className: "hidden lg:table-cell",
        cell: (deal) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(deal.expectedCloseOn, "long")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (deal) => (
          <RowActions label={`Actions for ${deal.name}`} actions={dealActions(deal)} />
        ),
      },
    ],
    // dealActions only closes over stable store callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyName, openEditor, setDealArchived],
  );

  const table = useTableState(tableDeals, columns, {
    initialSort: { id: "value", direction: "desc" },
  });
  const hasFilters = query !== "" || owner !== "all";

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Leads & Deals"
        description={
          openTotal.length > 0
            ? `${formatMoney(sumValue(openTotal))} across ${openTotal.length} open ${openTotal.length === 1 ? "deal" : "deals"}.`
            : "Track opportunities from first contact to a decision."
        }
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("deal")}>
            <Plus data-icon="inline-start" aria-hidden />
            New deal
          </Button>
        }
      />

      {deals.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Handshake}
            title="No deals yet"
            description="Add a deal to start your pipeline, or turn demo data on in the sidebar."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("deal")}>
                New deal
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search deals" />
            <FilterMenu label="Owner" options={ownerOptions} value={owner} onChange={setOwner} />
            {view === "table" ? (
              <FilterMenu
                label="Status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
              />
            ) : null}
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setOwner("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <div className="ml-auto">
              <SegmentedControl
                label="View"
                options={[
                  { value: "board", label: "Board" },
                  { value: "table", label: "Table" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          </TableToolbar>

          {view === "board" ? (
            <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <div className="grid min-w-[880px] grid-cols-4 gap-4 lg:min-w-0">
                {OPEN_DEAL_STAGES.map((stage) => {
                  const inStage = boardDeals.filter((deal) => deal.stage === stage.id);
                  return (
                    <section
                      key={stage.id}
                      aria-label={`${stage.label}, ${inStage.length} ${inStage.length === 1 ? "deal" : "deals"}`}
                      className="flex min-w-0 flex-col rounded-lg border bg-canvas/60"
                    >
                      <header className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
                        <h2 className="font-semibold">
                          {stage.label}{" "}
                          <span className="tabular font-normal text-muted-foreground">
                            {inStage.length}
                          </span>
                        </h2>
                        <p className="tabular text-caption text-muted-foreground">
                          {formatMoney(sumValue(inStage))}
                        </p>
                      </header>
                      <ul className="flex flex-1 flex-col gap-2 p-2">
                        {inStage.length === 0 ? (
                          <li className="px-2 py-6 text-center text-caption text-muted-foreground">
                            {hasFilters ? "No matching deals." : "No deals at this stage."}
                          </li>
                        ) : (
                          inStage.map((deal) => (
                            <li
                              key={deal.id}
                              className="rounded-md border bg-card p-3 shadow-[0_1px_0_rgb(28_36_52/0.04)]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(deal.id)}
                                  className="min-w-0 rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                  {deal.name}
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="-mt-0.5 -mr-1"
                                      aria-label={`Move ${deal.name} to another stage`}
                                    >
                                      <ArrowRightLeft aria-hidden />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-40">
                                    <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup
                                      value={deal.stage}
                                      onValueChange={(value) =>
                                        changeStage(deal, value as DealStage)
                                      }
                                    >
                                      {DEAL_STAGES.map((option) => (
                                        <DropdownMenuRadioItem key={option.id} value={option.id}>
                                          {option.label}
                                        </DropdownMenuRadioItem>
                                      ))}
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <p className="truncate text-caption text-muted-foreground">
                                {companyName(deal.companyId)}
                              </p>
                              <div className="mt-3 flex items-end justify-between gap-2">
                                <span className="font-display text-base font-semibold">
                                  {formatMoney(deal.valueMinor)}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="tabular">
                                    {formatDate(deal.expectedCloseOn)}
                                  </span>
                                  <UserAvatar
                                    name={memberName(deal.ownerId)}
                                    className="size-5 [&_[data-slot=avatar-fallback]]:text-[10px]"
                                  />
                                  <span className="sr-only">Owner: {memberName(deal.ownerId)}</span>
                                </span>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <section aria-label="Deals" className="overflow-hidden rounded-lg border bg-card">
              {tableDeals.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No deals match"
                  description="Try a different search, owner or status."
                  className="py-14"
                />
              ) : (
                <DataTable
                  caption="Deals"
                  columns={columns}
                  rows={table.pageRows}
                  getRowId={(deal) => deal.id}
                  sort={table.sort}
                  onSort={table.toggleSort}
                />
              )}
              <Pagination {...table.pagination} noun="deals" />
            </section>
          )}
          {view === "board" ? (
            <p className="text-caption text-muted-foreground">
              The board shows open deals. Won, lost and archived deals are in the table view.
            </p>
          ) : null}
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md" onCloseAutoFocus={returnFocus}>
          {selected ? (
            <>
              <SheetHeader className="border-b pr-12">
                <SheetTitle className="font-display text-lg">{selected.name}</SheetTitle>
                <SheetDescription>
                  <Link
                    href={`/crm/companies/${selected.companyId}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {companyName(selected.companyId)}
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                <div>
                  <p className="text-caption text-muted-foreground">Value</p>
                  <p className="font-display text-figure">{formatMoney(selected.valueMinor)}</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={stageSelectId}>Stage</Label>
                  <Select
                    value={selected.stage}
                    onValueChange={(value) => changeStage(selected, value as DealStage)}
                    disabled={selected.archived}
                  >
                    <SelectTrigger id={stageSelectId} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_STAGES.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selected.archived ? (
                    <p className="text-xs text-muted-foreground">
                      Restore this deal to change its stage.
                    </p>
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <dt className="text-caption text-muted-foreground">Contact</dt>
                    <dd>
                      {selected.contactId ? (
                        <Link
                          href={`/crm/contacts/${selected.contactId}`}
                          className="text-primary hover:underline"
                        >
                          {store.contacts.find((contact) => contact.id === selected.contactId)
                            ?.name ?? "Unknown"}
                        </Link>
                      ) : (
                        "None"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Owner</dt>
                    <dd>{memberName(selected.ownerId)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Expected close</dt>
                    <dd className="tabular">{formatDate(selected.expectedCloseOn, "long")}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Status</dt>
                    <dd>
                      <DealStageBadge stage={selected.stage} archived={selected.archived} />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2 border-t p-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedId(null);
                    openEditor("deal", selected.id);
                  }}
                >
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                </Button>
                {selected.archived ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDealArchived(selected.id, false);
                      toast.success(`“${selected.name}” restored`);
                    }}
                  >
                    <ArchiveRestore data-icon="inline-start" aria-hidden />
                    Restore
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedId(null);
                      setArchiveTarget(selected);
                    }}
                  >
                    <Archive data-icon="inline-start" aria-hidden />
                    Archive
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive “${archiveTarget?.name ?? "deal"}”?`}
        description="The deal leaves the board and pipeline totals. You can restore it from the table view’s Archived status."
        confirmLabel="Archive deal"
        onConfirm={() => {
          if (!archiveTarget) return;
          setDealArchived(archiveTarget.id, true);
          toast.success(`“${archiveTarget.name}” archived`, {
            action: { label: "Undo", onClick: () => setDealArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}
