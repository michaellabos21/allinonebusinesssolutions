"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  ListChecks,
  type LucideIcon,
  Plus,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { MultiFilterMenu, SegmentedControl, TableToolbar } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { TaskPanel } from "@/components/work/task-panel";
import { DEMO_TODAY } from "@/config/app";
import { formatDate } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";
import {
  type CalendarEvent,
  type CalendarEventKind,
  formatMonth,
  getCalendarEvents,
  getMonthGrid,
  shiftMonth,
} from "@/lib/work";
import { cn } from "@/lib/utils";

type View = "month" | "agenda";

const KINDS: { value: CalendarEventKind; label: string; icon: LucideIcon }[] = [
  { value: "task", label: "Tasks", icon: ListChecks },
  { value: "project", label: "Project deadlines", icon: FolderKanban },
  { value: "invoice", label: "Invoice due dates", icon: ReceiptText },
];
const KIND_ICON = Object.fromEntries(KINDS.map((kind) => [kind.value, kind.icon])) as Record<
  CalendarEventKind,
  LucideIcon
>;
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
/** Chips per day cell before the rest collapse into "+n more". */
const CELL_LIMIT = 2;

function EventRow({
  event,
  onOpenTask,
}: {
  event: CalendarEvent;
  onOpenTask: (id: string) => void;
}) {
  const Icon = KIND_ICON[event.kind];
  const body = (
    <>
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-medium",
            event.done && "font-normal text-muted-foreground line-through",
          )}
        >
          {event.title}
        </span>
        <span className="block truncate text-caption text-muted-foreground">{event.detail}</span>
      </span>
      {event.late ? (
        <span className="shrink-0 text-caption font-medium text-danger">Overdue</span>
      ) : null}
      {event.done ? (
        <span className="shrink-0 text-caption text-muted-foreground">Done</span>
      ) : null}
    </>
  );
  const className =
    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50";

  return event.taskId ? (
    <button type="button" className={className} onClick={() => onOpenTask(event.taskId!)}>
      {body}
    </button>
  ) : (
    <Link href={event.href ?? "#"} className={className}>
      {body}
    </Link>
  );
}

export function CalendarScreen() {
  const { tasks, projects, invoices, contactCompanyName, openQuickCreate } = useDemoStore();
  const [view, setView] = useState<View>("month");
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [selected, setSelected] = useState(DEMO_TODAY);
  const [kinds, setKinds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  const events = useMemo(
    () =>
      getCalendarEvents({ tasks, projects, invoices, clientName: contactCompanyName }).filter(
        (event) => kinds.length === 0 || kinds.includes(event.kind),
      ),
    [tasks, projects, invoices, contactCompanyName, kinds],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [events]);

  const grid = getMonthGrid(month);
  const firstDay = getRuntime().weekStartsOn;
  const weekdays = [...WEEKDAY_NAMES.slice(firstDay), ...WEEKDAY_NAMES.slice(0, firstDay)];
  const monthEvents = events.filter((event) => event.date.startsWith(month));
  const agendaDays = [...new Set(monthEvents.map((event) => event.date))];
  const selectedEvents = byDate.get(selected) ?? [];

  function goToMonth(next: string) {
    setMonth(next);
    // Keep a day selected inside the visible month so the day list is never stale.
    setSelected(next === DEMO_TODAY.slice(0, 7) ? DEMO_TODAY : `${next}-01`);
  }

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Calendar"
        description="Task due dates, project deadlines and invoice due dates in one place."
        actions={
          <Button
            className="hover:bg-primary-hover"
            onClick={() => openQuickCreate("task", { dueOn: selected })}
          >
            <Plus data-icon="inline-start" aria-hidden />
            New task
          </Button>
        }
      />

      <TableToolbar>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => goToMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => goToMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <h2 className="min-w-36 font-display text-lg font-semibold" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <Button
          variant="outline"
          disabled={month === DEMO_TODAY.slice(0, 7) && selected === DEMO_TODAY}
          onClick={() => goToMonth(DEMO_TODAY.slice(0, 7))}
        >
          Today
        </Button>
        <MultiFilterMenu
          label="Show"
          options={KINDS.map(({ value, label }) => ({ value, label }))}
          values={kinds}
          onChange={setKinds}
          anyLabel="Everything"
        />
        <div className="ml-auto">
          <SegmentedControl
            label="View"
            options={[
              { value: "month", label: "Month" },
              { value: "agenda", label: "Agenda" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </TableToolbar>

      {view === "month" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section
            aria-label={formatMonth(month)}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              {weekdays.map((day) => (
                <div key={day} className="px-2 py-2 text-center md:text-left">
                  <span aria-hidden>{day.slice(0, 3)}</span>
                  <span className="sr-only">{day}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((cell) => {
                const dayEvents = byDate.get(cell.iso) ?? [];
                const isToday = cell.iso === DEMO_TODAY;
                const isSelected = cell.iso === selected;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(cell.iso, "weekday")}, ${dayEvents.length} ${dayEvents.length === 1 ? "item" : "items"}`}
                    onClick={() => setSelected(cell.iso)}
                    className={cn(
                      "relative -mt-px -ml-px flex min-h-14 flex-col items-center gap-1 border-t border-l p-1.5 text-left outline-none hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:min-h-24 md:items-stretch",
                      !cell.inMonth && "bg-muted/30 text-muted-foreground",
                      isSelected && "bg-primary-soft hover:bg-primary-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular flex size-6 items-center justify-center rounded-full text-xs",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                    {/* Small screens: a count. Wider screens: the first items by name. */}
                    {dayEvents.length > 0 ? (
                      <span
                        className="tabular rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground md:hidden"
                        aria-hidden
                      >
                        {dayEvents.length}
                      </span>
                    ) : null}
                    <span className="hidden min-w-0 flex-col gap-0.5 md:flex" aria-hidden>
                      {dayEvents.slice(0, CELL_LIMIT).map((event) => {
                        const Icon = KIND_ICON[event.kind];
                        return (
                          <span
                            key={event.id}
                            className={cn(
                              "flex items-center gap-1 rounded-sm bg-muted px-1 py-0.5 text-[11px] leading-tight text-foreground",
                              event.done && "text-muted-foreground line-through",
                              event.late && "bg-danger-soft text-danger",
                            )}
                          >
                            <Icon className="size-3 shrink-0" />
                            <span className="truncate">{event.title}</span>
                          </span>
                        );
                      })}
                      {dayEvents.length > CELL_LIMIT ? (
                        <span className="px-1 text-[11px] text-muted-foreground">
                          +{dayEvents.length - CELL_LIMIT} more
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Selected day" className="self-start rounded-lg border bg-card">
            <div className="px-5 pt-4">
              <h2 className="text-section">{formatDate(selected, "weekday")}</h2>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {selectedEvents.length === 0
                  ? "Nothing due."
                  : `${selectedEvents.length} ${selectedEvents.length === 1 ? "item" : "items"} due.`}
              </p>
            </div>
            <div className="px-2 pt-2 pb-2">
              {selectedEvents.length === 0 ? (
                <div className="px-3 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openQuickCreate("task", { dueOn: selected })}
                  >
                    <Plus data-icon="inline-start" aria-hidden />
                    Add a task for this day
                  </Button>
                </div>
              ) : (
                <ul>
                  {selectedEvents.map((event) => (
                    <li key={event.id}>
                      <EventRow event={event} onOpenTask={setTaskId} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section
          aria-label={`Agenda for ${formatMonth(month)}`}
          className="rounded-lg border bg-card"
        >
          {agendaDays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={`Nothing due in ${formatMonth(month)}`}
              description="Try another month, or add a task with a due date."
              action={
                <Button
                  variant="outline"
                  onClick={() => openQuickCreate("task", { dueOn: selected })}
                >
                  New task
                </Button>
              }
              className="py-14"
            />
          ) : (
            <ol className="divide-y">
              {agendaDays.map((date) => (
                <li
                  key={date}
                  className="grid gap-x-4 px-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)]"
                >
                  <h3
                    className={cn(
                      "px-2 pt-2 pb-1 font-medium",
                      date === DEMO_TODAY && "text-primary",
                    )}
                  >
                    <span className="tabular">{formatDate(date, "weekdayShort")}</span>
                    {date === DEMO_TODAY ? (
                      <span className="block text-caption font-normal">Today</span>
                    ) : null}
                  </h3>
                  <ul>
                    {(byDate.get(date) ?? []).map((event) => (
                      <li key={event.id}>
                        <EventRow event={event} onOpenTask={setTaskId} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <TaskPanel taskId={taskId} onClose={() => setTaskId(null)} />
    </div>
  );
}
