"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Download,
  Handshake,
  Pencil,
  Plus,
  SearchX,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
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
import { StagesDialog } from "@/components/crm/stages-dialog";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { downloadCsv, toCsv } from "@/lib/csv-export";
import { formatDate, formatMoney, formatRelativeDay } from "@/lib/format";
import { getOpenDeals } from "@/lib/metrics";
import { moveDeal, setDealArchived } from "@/lib/record-actions";
import { getToday, memberName } from "@/lib/runtime";
import { useFocusReturn } from "@/lib/use-focus-return";
import type { Deal, DealStage } from "@/mocks";
import { type DealHistoryEntry, getDealHistoryAction } from "@/server/actions/sales";
import { can } from "@/server/permissions";

type View = "board" | "table";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
  { value: "archived", label: "Archived" },
];

const sumValue = (deals: Deal[]) => deals.reduce((total, deal) => total + deal.valueMinor, 0);
/** The deal id carried in a drag, under our own type so other drags are ignored. */
const DRAG_TYPE = "application/x-deal-id";

export function DealsScreen() {
  const store = useDemoStore();
  const { deals, liveStages, stageOf, companyName, openQuickCreate, openEditor } = store;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canManagePipeline = can(store.account.workspace.role, "pipeline.manage");
  const canArchive = can(store.account.workspace.role, "records.archive");

  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("open");
  const [archiveTarget, setArchiveTarget] = useState<Deal | null>(null);
  const [lostTarget, setLostTarget] = useState<{ deal: Deal; stage: DealStage } | null>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [dropStage, setDropStage] = useState<string | null>(null);

  // The open deal lives in the address, so a deal can be linked to directly.
  const selectedId = searchParams.get("deal");
  const selected = deals.find((deal) => deal.id === selectedId) ?? null;
  const returnFocus = useFocusReturn(selected !== null);
  const selectDeal = (id: string | null) =>
    router.replace(id ? `${pathname}?deal=${id}` : pathname, { scroll: false });

  const ownerOptions = [
    { value: "all", label: "Anyone" },
    ...store.team.map((member) => ({ value: member.id, label: member.name })),
  ];
  const openStages = liveStages.filter((stage) => stage.kind === "open");
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
    return live.filter((deal) => deal.stageKind === status);
  }, [matching, status]);

  /** Moves a deal; a lost stage first asks why. */
  async function changeStage(deal: Deal, stageId: string) {
    if (deal.stageId === stageId) return;
    const stage = stageOf(stageId);
    if (!stage) return;
    if (stage.kind === "lost") {
      setLostTarget({ deal, stage });
      return;
    }
    const previous = deal.stageId;
    if (!(await moveDeal(deal.id, stageId))) return;
    toast.success(
      stage.kind === "won" ? `“${deal.name}” won` : `“${deal.name}” moved to ${stage.name}`,
      {
        action: {
          label: "Undo",
          onClick: () => moveDeal(deal.id, previous, deal.lostReason),
        },
      },
    );
  }

  function dealActions(deal: Deal) {
    return [
      { label: "Edit", icon: Pencil, onSelect: () => openEditor("deal", deal.id) },
      ...(canArchive
        ? [
            deal.archived
              ? {
                  label: "Restore",
                  icon: ArchiveRestore,
                  onSelect: async () => {
                    if (await setDealArchived(deal.id, false)) {
                      toast.success(`“${deal.name}” restored`);
                    }
                  },
                }
              : {
                  label: "Archive",
                  icon: Archive,
                  destructive: true,
                  onSelect: () => setArchiveTarget(deal),
                },
          ]
        : []),
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
              onClick={() => selectDeal(deal.id)}
              className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {deal.name}
            </button>
            {deal.companyId ? (
              <Link
                href={`/crm/companies/${deal.companyId}`}
                className="block truncate text-caption text-muted-foreground hover:text-foreground hover:underline"
              >
                {companyName(deal.companyId)}
              </Link>
            ) : (
              <span className="block text-caption text-muted-foreground">No company</span>
            )}
          </div>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        sortValue: (deal) => stageOf(deal.stageId)?.position ?? 0,
        cell: (deal) => <DealStageBadge stage={stageOf(deal.stageId)} archived={deal.archived} />,
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
        header: "Close",
        sortValue: (deal) => deal.closedOn ?? deal.expectedCloseOn,
        className: "hidden lg:table-cell",
        cell: (deal) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {deal.closedOn
              ? `Closed ${formatDate(deal.closedOn, "long")}`
              : formatDate(deal.expectedCloseOn, "long")}
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
    // dealActions and selectDeal only close over stable callbacks and the role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyName, stageOf, openEditor, canArchive],
  );

  const table = useTableState(tableDeals, columns, {
    initialSort: { id: "value", direction: "desc" },
  });
  const hasFilters = query !== "" || owner !== "all";

  function exportCsv() {
    const rows = (view === "table" ? tableDeals : boardDeals).map((deal) => [
      deal.name,
      companyName(deal.companyId),
      store.contactName(deal.contactId),
      stageOf(deal.stageId)?.name ?? "",
      (deal.valueMinor / 100).toFixed(2),
      deal.currency,
      memberName(deal.ownerId),
      deal.expectedCloseOn,
      deal.closedOn ?? "",
      deal.lostReason,
    ]);
    downloadCsv(
      `deals-${getToday()}.csv`,
      toCsv(
        [
          "Deal",
          "Company",
          "Contact",
          "Stage",
          "Value",
          "Currency",
          "Owner",
          "Expected close",
          "Closed on",
          "Lost reason",
        ],
        rows,
      ),
    );
  }

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Deals"
        description={
          openTotal.length > 0
            ? `${formatMoney(sumValue(openTotal))} across ${openTotal.length} open ${openTotal.length === 1 ? "deal" : "deals"}.`
            : "Track opportunities from first contact to a decision."
        }
        actions={
          <>
            {deals.length > 0 ? (
              <Button variant="outline" onClick={exportCsv}>
                <Download data-icon="inline-start" aria-hidden />
                Export CSV
              </Button>
            ) : null}
            {canManagePipeline ? (
              <Button variant="outline" onClick={() => setStagesOpen(true)}>
                <Settings2 data-icon="inline-start" aria-hidden />
                Edit stages
              </Button>
            ) : null}
            <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("deal")}>
              <Plus data-icon="inline-start" aria-hidden />
              New deal
            </Button>
          </>
        }
      />

      {deals.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Handshake}
            title="No deals yet"
            description="Add a deal, or convert a qualified lead into one."
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
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(openStages.length, 1)}, minmax(220px, 1fr))`,
                }}
              >
                {openStages.map((stage) => {
                  const inStage = boardDeals.filter((deal) => deal.stageId === stage.id);
                  return (
                    <section
                      key={stage.id}
                      aria-label={`${stage.name}, ${inStage.length} ${inStage.length === 1 ? "deal" : "deals"}`}
                      onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                        event.preventDefault();
                        setDropStage(stage.id);
                      }}
                      onDragLeave={() => setDropStage(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDropStage(null);
                        const deal = deals.find(
                          (item) => item.id === event.dataTransfer.getData(DRAG_TYPE),
                        );
                        if (deal) changeStage(deal, stage.id);
                      }}
                      className={`flex min-w-0 flex-col rounded-lg border bg-canvas/60 ${dropStage === stage.id ? "ring-3 ring-ring/50" : ""}`}
                    >
                      <header className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
                        <h2 className="font-semibold">
                          {stage.name}{" "}
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
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData(DRAG_TYPE, deal.id);
                                event.dataTransfer.effectAllowed = "move";
                              }}
                              className="cursor-grab rounded-md border bg-card p-3 shadow-[0_1px_0_rgb(28_36_52/0.04)] active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => selectDeal(deal.id)}
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
                                      value={deal.stageId}
                                      onValueChange={(value) => changeStage(deal, value)}
                                    >
                                      {liveStages.map((option) => (
                                        <DropdownMenuRadioItem key={option.id} value={option.id}>
                                          {option.name}
                                        </DropdownMenuRadioItem>
                                      ))}
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <p className="truncate text-caption text-muted-foreground">
                                {companyName(deal.companyId) || "No company"}
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
              Drag a card to another stage, or use its move button. The board shows open deals; won,
              lost and archived deals are in the table view.
            </p>
          ) : null}
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && selectDeal(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md" onCloseAutoFocus={returnFocus}>
          {selected ? (
            <DealDetail
              deal={selected}
              onMove={(stageId) => changeStage(selected, stageId)}
              onEdit={() => {
                selectDeal(null);
                openEditor("deal", selected.id);
              }}
              onArchive={
                canArchive
                  ? () => {
                      selectDeal(null);
                      setArchiveTarget(selected);
                    }
                  : undefined
              }
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <LostReasonDialog
        target={lostTarget}
        onClose={() => setLostTarget(null)}
        onConfirm={async (reason) => {
          if (!lostTarget) return;
          const { deal, stage } = lostTarget;
          if (!(await moveDeal(deal.id, stage.id, reason))) return;
          setLostTarget(null);
          toast.success(`“${deal.name}” marked as lost`, {
            action: { label: "Undo", onClick: () => moveDeal(deal.id, deal.stageId) },
          });
        }}
      />

      <StagesDialog open={stagesOpen} onOpenChange={setStagesOpen} />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive “${archiveTarget?.name ?? "deal"}”?`}
        description="The deal leaves the board and pipeline totals. You can restore it from the table view’s Archived status."
        confirmLabel="Archive deal"
        onConfirm={async () => {
          if (!archiveTarget) return;
          if (!(await setDealArchived(archiveTarget.id, true))) return;
          toast.success(`“${archiveTarget.name}” archived`, {
            action: { label: "Undo", onClick: () => setDealArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}

function DealDetail({
  deal,
  onMove,
  onEdit,
  onArchive,
}: {
  deal: Deal;
  onMove: (stageId: string) => void;
  onEdit: () => void;
  onArchive?: () => void;
}) {
  const store = useDemoStore();
  const stageSelectId = useId();
  const [history, setHistory] = useState<DealHistoryEntry[] | null>(null);

  // History is fetched per deal: the workspace feed only keeps recent entries.
  // Moving or editing the deal changes `deal`, which fetches it again.
  useEffect(() => {
    let current = true;
    getDealHistoryAction(deal.id).then((result) => {
      if (current) setHistory(result.ok ? (result.data ?? []) : []);
    });
    return () => {
      current = false;
    };
  }, [deal]);

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="font-display text-lg">{deal.name}</SheetTitle>
        <SheetDescription>
          {deal.companyId ? (
            <Link
              href={`/crm/companies/${deal.companyId}`}
              className="hover:text-foreground hover:underline"
            >
              {store.companyName(deal.companyId)}
            </Link>
          ) : (
            "No company"
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <p className="text-caption text-muted-foreground">Value</p>
          <p className="font-display text-figure">{formatMoney(deal.valueMinor)}</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={stageSelectId}>Stage</Label>
          <Select value={deal.stageId} onValueChange={onMove} disabled={deal.archived}>
            <SelectTrigger id={stageSelectId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {store.liveStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {deal.archived ? (
            <p className="text-xs text-muted-foreground">Restore this deal to change its stage.</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt className="text-caption text-muted-foreground">Contact</dt>
            <dd>
              {deal.contactId ? (
                <Link
                  href={`/crm/contacts/${deal.contactId}`}
                  className="text-primary hover:underline"
                >
                  {store.contactName(deal.contactId) || "Unknown"}
                </Link>
              ) : (
                "None"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Owner</dt>
            <dd>{memberName(deal.ownerId)}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">
              {deal.closedOn ? "Closed" : "Expected close"}
            </dt>
            <dd className="tabular">{formatDate(deal.closedOn ?? deal.expectedCloseOn, "long")}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Status</dt>
            <dd>
              <DealStageBadge stage={store.stageOf(deal.stageId)} archived={deal.archived} />
            </dd>
          </div>
          {deal.lostReason ? (
            <div className="col-span-2">
              <dt className="text-caption text-muted-foreground">Reason lost</dt>
              <dd>{deal.lostReason}</dd>
            </div>
          ) : null}
        </dl>
        <section aria-labelledby={`${stageSelectId}-history`}>
          <h3 id={`${stageSelectId}-history`} className="mb-2 font-semibold">
            History
          </h3>
          {history === null ? (
            <p className="text-caption text-muted-foreground">Loading history</p>
          ) : history.length === 0 ? (
            <p className="text-caption text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-medium">{entry.actor}</span>{" "}
                  <span className="text-muted-foreground">{entry.action}</span>
                  <span className="block text-caption text-muted-foreground">
                    {formatRelativeDay(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <div className="flex flex-wrap gap-2 border-t p-4">
        <Button variant="outline" onClick={onEdit}>
          <Pencil data-icon="inline-start" aria-hidden />
          Edit
        </Button>
        {onArchive && !deal.archived ? (
          <Button variant="outline" onClick={onArchive}>
            <Archive data-icon="inline-start" aria-hidden />
            Archive
          </Button>
        ) : null}
      </div>
    </>
  );
}

/** Asks why a deal was lost before moving it to a lost stage. */
function LostReasonDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: { deal: Deal; stage: DealStage } | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (open || busy) return;
        setReason("");
        setError("");
        onClose();
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!reason.trim()) {
              setError("Say why the deal was lost.");
              return;
            }
            setBusy(true);
            await onConfirm(reason.trim());
            setBusy(false);
            setReason("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Mark “{target?.deal.name}” as lost?</DialogTitle>
            <DialogDescription>
              It moves to {target?.stage.name}. The reason is kept with the deal and in its history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={id}>Reason lost</Label>
            <Input
              id={id}
              value={reason}
              maxLength={300}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError("");
              }}
              placeholder="Went with another supplier"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              autoFocus
            />
            {error ? (
              <p id={`${id}-error`} className="text-caption text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Mark as lost
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
