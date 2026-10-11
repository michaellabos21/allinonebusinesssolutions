"use client";

import { ArrowRightLeft, ListChecks, Pencil, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { PriorityBadge, TaskStatusBadge } from "@/components/common/status-badge";
import {
  FilterMenu,
  SearchInput,
  SegmentedControl,
  TableToolbar,
} from "@/components/common/table-toolbar";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { setTaskStatus } from "@/lib/record-actions";
import { getToday } from "@/lib/runtime";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCheck } from "@/components/work/task-check";
import { TaskPanel } from "@/components/work/task-panel";
import { addDays, describeDue, formatDate } from "@/lib/format";
import { memberName, sortTasksForList } from "@/lib/work";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/mocks";

type View = "list" | "board";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  ...TASK_STATUSES.map((status) => ({ value: status.id as string, label: status.label })),
  { value: "all", label: "All" },
];
const PRIORITY_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
/** Finished work piles up; the board shows the latest and points to the list for the rest. */
const DONE_COLUMN_LIMIT = 6;

export function TasksScreen() {
  const { tasks, projects, team, openQuickCreate, openEditor } = useDemoStore();
  const today = getToday();
  const assigneeOptions = [
    { value: "all", label: "Anyone" },
    ...team.map((member) => ({ value: member.id, label: member.name })),
  ];
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [taskId, setTaskId] = useState<string | null>(null);

  const projectName = useMemo(() => {
    const names = new Map(projects.map((project) => [project.id, project.name]));
    return (id: string | null) => (id ? (names.get(id) ?? "") : "");
  }, [projects]);

  /** Search, priority and assignee apply to both views; status only narrows the list. */
  const matching = useMemo(() => {
    const text = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (priority !== "all" && task.priority !== priority) return false;
      if (assignee !== "all" && task.assigneeId !== assignee) return false;
      return (
        !text ||
        [task.title, projectName(task.projectId)].some((value) =>
          value.toLowerCase().includes(text),
        )
      );
    });
  }, [tasks, projectName, query, priority, assignee]);

  const listTasks = useMemo(
    () =>
      matching.filter((task) =>
        status === "all"
          ? true
          : status === "open"
            ? task.status !== "done"
            : task.status === status,
      ),
    [matching, status],
  );

  async function move(task: Task, next: TaskStatus) {
    if (task.status === next) return;
    const previous = task.status;
    if (!(await setTaskStatus(task.id, next))) return;
    toast.success(`Task moved to ${TASK_STATUSES.find((item) => item.id === next)?.label}`, {
      description: task.title,
      action: { label: "Undo", onClick: () => setTaskStatus(task.id, previous) },
    });
  }

  const columns = useMemo<Column<Task>[]>(
    () => [
      {
        id: "title",
        header: "Task",
        sortValue: (task) => task.title,
        cell: (task) => {
          const done = task.status === "done";
          return (
            <div className="flex min-w-48 items-start gap-3">
              <TaskCheck task={task} className="mt-0.5" />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setTaskId(task.id)}
                  className={cn(
                    "rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
                    done && "font-normal text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </button>
                {task.projectId ? (
                  <Link
                    href={`/work/projects/${task.projectId}`}
                    className="block text-caption text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {projectName(task.projectId)}
                  </Link>
                ) : (
                  <span className="block text-caption text-muted-foreground">No project</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "assignee",
        header: "Assignee",
        sortValue: (task) => memberName(task.assigneeId),
        className: "hidden md:table-cell",
        cell: (task) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <UserAvatar name={memberName(task.assigneeId)} className="size-6" />
            {memberName(task.assigneeId)}
          </span>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        sortValue: (task) => PRIORITY_RANK[task.priority],
        className: "hidden sm:table-cell",
        cell: (task) => <PriorityBadge priority={task.priority} short />,
      },
      {
        id: "status",
        header: "Status",
        sortValue: (task) => TASK_STATUSES.findIndex((item) => item.id === task.status),
        className: "hidden lg:table-cell",
        cell: (task) => <TaskStatusBadge status={task.status} />,
      },
      {
        id: "due",
        header: "Due",
        sortValue: (task) => task.dueOn,
        cell: (task) => {
          const due = describeDue(task.dueOn);
          const late = task.status !== "done" && due.tone === "overdue";
          return (
            <span
              className={cn(
                "tabular whitespace-nowrap",
                late ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              {late ? due.label : formatDate(task.dueOn)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (task) => (
          <RowActions
            label={`Actions for ${task.title}`}
            actions={[{ label: "Edit", icon: Pencil, onSelect: () => openEditor("task", task.id) }]}
          />
        ),
      },
    ],
    [projectName, openEditor],
  );

  const table = useTableState(listTasks, columns, {
    pageSize: 10,
    initialSort: { id: "due", direction: "asc" },
  });
  const hasFilters = query !== "" || priority !== "all" || assignee !== "all";

  const open = tasks.filter((task) => task.status !== "done");
  const overdue = open.filter((task) => task.dueOn < today).length;
  const thisWeek = open.filter(
    (task) => task.dueOn >= today && task.dueOn <= addDays(today, 6),
  ).length;

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Tasks"
        description={
          tasks.length > 0
            ? `${open.length} open, ${overdue} overdue, ${thisWeek} due in the next 7 days.`
            : "Everything that needs doing, across projects."
        }
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("task")}>
            <Plus data-icon="inline-start" aria-hidden />
            New task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add the next thing that is due, or turn demo data on in the sidebar."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("task")}>
                New task
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search tasks" />
            {view === "list" ? (
              <FilterMenu
                label="Status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
              />
            ) : null}
            <FilterMenu
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={priority}
              onChange={setPriority}
            />
            <FilterMenu
              label="Assignee"
              options={assigneeOptions}
              value={assignee}
              onChange={setAssignee}
            />
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setPriority("all");
                  setAssignee("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <div className="ml-auto">
              <SegmentedControl
                label="View"
                options={[
                  { value: "list", label: "List" },
                  { value: "board", label: "Board" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          </TableToolbar>

          {view === "list" ? (
            <section aria-label="Tasks" className="overflow-hidden rounded-lg border bg-card">
              {listTasks.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No tasks match"
                  description="Try a different search, status, priority or assignee."
                  className="py-14"
                />
              ) : (
                <DataTable
                  caption="Tasks"
                  columns={columns}
                  rows={table.pageRows}
                  getRowId={(task) => task.id}
                  sort={table.sort}
                  onSort={table.toggleSort}
                />
              )}
              <Pagination {...table.pagination} noun="tasks" />
            </section>
          ) : (
            <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <div className="grid min-w-[780px] grid-cols-3 gap-4 lg:min-w-0">
                {TASK_STATUSES.map((column) => {
                  const inColumn = sortTasksForList(
                    matching.filter((task) => task.status === column.id),
                  );
                  const shown =
                    column.id === "done" ? inColumn.slice(0, DONE_COLUMN_LIMIT) : inColumn;
                  return (
                    <section
                      key={column.id}
                      aria-label={`${column.label}, ${inColumn.length} ${inColumn.length === 1 ? "task" : "tasks"}`}
                      className="flex min-w-0 flex-col rounded-lg border bg-canvas/60"
                    >
                      <header className="border-b px-3 py-2.5">
                        <h2 className="font-semibold">
                          {column.label}{" "}
                          <span className="tabular font-normal text-muted-foreground">
                            {inColumn.length}
                          </span>
                        </h2>
                      </header>
                      <ul className="flex flex-1 flex-col gap-2 p-2">
                        {inColumn.length === 0 ? (
                          <li className="px-2 py-6 text-center text-caption text-muted-foreground">
                            {hasFilters ? "No matching tasks." : "Nothing here."}
                          </li>
                        ) : (
                          shown.map((task) => {
                            const due = describeDue(task.dueOn);
                            const done = task.status === "done";
                            return (
                              <li
                                key={task.id}
                                className="rounded-md border bg-card p-3 shadow-[0_1px_0_rgb(28_36_52/0.04)]"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setTaskId(task.id)}
                                    className={cn(
                                      "min-w-0 rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
                                      done && "font-normal text-muted-foreground line-through",
                                    )}
                                  >
                                    {task.title}
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="-mt-0.5 -mr-1"
                                        aria-label={`Move “${task.title}” to another column`}
                                      >
                                        <ArrowRightLeft aria-hidden />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-40">
                                      <DropdownMenuLabel>Move to</DropdownMenuLabel>
                                      <DropdownMenuRadioGroup
                                        value={task.status}
                                        onValueChange={(value) => move(task, value as TaskStatus)}
                                      >
                                        {TASK_STATUSES.map((option) => (
                                          <DropdownMenuRadioItem key={option.id} value={option.id}>
                                            {option.label}
                                          </DropdownMenuRadioItem>
                                        ))}
                                      </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <p className="truncate text-caption text-muted-foreground">
                                  {projectName(task.projectId) || "No project"}
                                </p>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5">
                                    {task.priority === "high" && !done ? (
                                      <PriorityBadge priority="high" short />
                                    ) : null}
                                    <span
                                      className={cn(
                                        "tabular text-xs",
                                        !done && due.tone === "overdue"
                                          ? "font-medium text-danger"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {done ? formatDate(task.dueOn) : due.label}
                                    </span>
                                  </span>
                                  <UserAvatar
                                    name={memberName(task.assigneeId)}
                                    className="size-5 [&_[data-slot=avatar-fallback]]:text-[10px]"
                                  />
                                  <span className="sr-only">
                                    Assigned to {memberName(task.assigneeId)}
                                  </span>
                                </div>
                              </li>
                            );
                          })
                        )}
                        {inColumn.length > shown.length ? (
                          <li className="px-2 py-1 text-center text-caption text-muted-foreground">
                            And {inColumn.length - shown.length} more in the list view.
                          </li>
                        ) : null}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <TaskPanel taskId={taskId} onClose={() => setTaskId(null)} />
    </div>
  );
}
