"use client";

import { ChevronRight, ListChecks, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { PriorityBadge } from "@/components/common/status-badge";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssigneeStack, DueLabel, STATUS_DOT, statusLabel } from "@/components/work/task-bits";
import { TaskCheck } from "@/components/work/task-check";
import { sortTasksForList } from "@/lib/work";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/mocks";
import { saveTaskAction } from "@/server/actions/tasks";

/** Checklist progress and comment count, shown only when there is something to show. */
export function TaskMeta({ task, className }: { task: Task; className?: string }) {
  const { checklist, commentCount } = task;
  if (!checklist.total && !commentCount) return null;
  return (
    <span className={cn("flex items-center gap-2.5 text-caption text-muted-foreground", className)}>
      {checklist.total ? (
        <span
          className={cn(
            "flex items-center gap-1 tabular",
            checklist.done === checklist.total && "text-success",
          )}
          title="Checklist"
        >
          <ListChecks className="size-3.5" aria-hidden />
          {checklist.done}/{checklist.total}
          <span className="sr-only"> checklist items done</span>
        </span>
      ) : null}
      {commentCount ? (
        <span className="flex items-center gap-1 tabular" title="Comments">
          <MessageSquare className="size-3.5" aria-hidden />
          {commentCount}
          <span className="sr-only"> {commentCount === 1 ? "comment" : "comments"}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Adds a task by title alone, into a status (and project) chosen by where it
 * was typed. It stays open after saving so several can be added in a row.
 */
export function QuickAddTask({
  status,
  projectId = null,
  className,
}: {
  status: TaskStatus;
  projectId?: string | null;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const text = title.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const result = await saveTaskAction({
        title: text,
        description: "",
        projectId,
        assigneeIds: [],
        status,
        priority: "medium",
        dueOn: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      input.current?.focus();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("justify-start text-muted-foreground", className)}
        onClick={() => setOpen(true)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add task
      </Button>
    );
  }
  return (
    <form
      className={cn("flex items-center gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor={id} className="sr-only">
        New task in {statusLabel(status)}
      </label>
      <Input
        ref={input}
        id={id}
        autoFocus
        value={title}
        maxLength={200}
        disabled={busy}
        placeholder="Task name, then Enter"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
        className="h-8"
      />
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setTitle("");
          setOpen(false);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}

/**
 * Tasks grouped by status, ClickUp style: each group can be collapsed and has
 * its own quick add. Done starts collapsed.
 */
export function TaskList({
  tasks,
  projectId = null,
  showProject = true,
  emptyHint,
}: {
  tasks: Task[];
  /** Tasks added here go into this project. */
  projectId?: string | null;
  showProject?: boolean;
  /** Shown under the groups when nothing matches at all. */
  emptyHint?: string;
}) {
  const { projectName } = useDemoStore();
  const [collapsed, setCollapsed] = useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    in_review: false,
    done: true,
  });

  return (
    <div className="space-y-3">
      {tasks.length === 0 && emptyHint ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-caption text-muted-foreground">
          {emptyHint}
        </p>
      ) : null}
      {TASK_STATUSES.map((group) => {
        const rows = sortTasksForList(tasks.filter((task) => task.status === group.id));
        const isCollapsed = collapsed[group.id];
        const regionId = `task-group-${group.id}`;
        return (
          <section
            key={group.id}
            aria-labelledby={`${regionId}-title`}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <h2 id={`${regionId}-title`} className="text-sm">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={regionId}
                onClick={() =>
                  setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))
                }
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-semibold outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronRight
                  aria-hidden
                  className={cn("size-4 transition-transform", !isCollapsed && "rotate-90")}
                />
                <span className={cn("size-2.5 rounded-full", STATUS_DOT[group.id])} aria-hidden />
                {group.label}
                <span className="tabular font-normal text-muted-foreground">{rows.length}</span>
              </button>
            </h2>
            {isCollapsed ? null : (
              <div id={regionId}>
                {rows.length ? (
                  <ul className="border-t">
                    {rows.map((task) => (
                      <li
                        key={task.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-dashed px-4 py-2.5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_7rem_8.5rem_5rem]"
                      >
                        <TaskCheck task={task} />
                        <div className="min-w-0">
                          <Link
                            href={`/work/tasks/${task.id}`}
                            className={cn(
                              "block truncate font-medium hover:underline",
                              task.status === "done" &&
                                "font-normal text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </Link>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {showProject && task.projectId ? (
                              <span className="truncate text-caption text-muted-foreground">
                                {projectName(task.projectId)}
                              </span>
                            ) : null}
                            <TaskMeta task={task} />
                            <DueLabel task={task} className="sm:hidden" />
                          </span>
                        </div>
                        <AssigneeStack
                          ids={task.assigneeIds}
                          className="justify-self-end sm:justify-self-start"
                        />
                        <DueLabel task={task} className="hidden sm:block" />
                        <span className="hidden sm:block">
                          {task.priority === "high" ? (
                            <PriorityBadge priority="high" short />
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="border-t px-2 py-1.5">
                  <QuickAddTask status={group.id} projectId={projectId} />
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
