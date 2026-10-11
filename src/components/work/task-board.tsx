"use client";

import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PriorityBadge } from "@/components/common/status-badge";
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
import {
  AssigneeStack,
  DueLabel,
  STATUS_DOT,
  statusLabel,
  useCanEditTask,
} from "@/components/work/task-bits";
import { QuickAddTask, TaskMeta } from "@/components/work/task-list";
import { setTaskStatus } from "@/lib/record-actions";
import { sortTasksForList } from "@/lib/work";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/mocks";

const DRAG_TYPE = "application/x-task-id";
/** Finished work piles up; the board shows the latest and points to the list for the rest. */
const DONE_COLUMN_LIMIT = 8;

/** Moves a task to another status, with an undo. */
export async function moveTask(task: Task, next: TaskStatus) {
  if (task.status === next) return;
  const previous = task.status;
  if (!(await setTaskStatus(task.id, next))) return;
  toast.success(`Moved to ${statusLabel(next)}`, {
    description: task.title,
    action: { label: "Undo", onClick: () => setTaskStatus(task.id, previous) },
  });
}

/**
 * A column per status. Cards can be dragged to another column, or moved
 * with the menu on each card, which also works from the keyboard.
 */
export function TaskBoard({
  tasks,
  projectId = null,
  showProject = true,
}: {
  tasks: Task[];
  projectId?: string | null;
  showProject?: boolean;
}) {
  const { projectName } = useDemoStore();
  const canEdit = useCanEditTask();
  const [dropOn, setDropOn] = useState<TaskStatus | null>(null);

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="grid min-w-[1000px] grid-cols-4 gap-3 lg:min-w-0">
        {TASK_STATUSES.map((column) => {
          const inColumn = sortTasksForList(tasks.filter((task) => task.status === column.id));
          const shown = column.id === "done" ? inColumn.slice(0, DONE_COLUMN_LIMIT) : inColumn;
          return (
            <section
              key={column.id}
              aria-label={`${column.label}, ${inColumn.length} ${inColumn.length === 1 ? "task" : "tasks"}`}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setDropOn(column.id);
              }}
              onDragLeave={() => setDropOn(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDropOn(null);
                const task = tasks.find(
                  (item) => item.id === event.dataTransfer.getData(DRAG_TYPE),
                );
                if (task) void moveTask(task, column.id);
              }}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border bg-canvas/60",
                dropOn === column.id && "ring-3 ring-ring/50",
              )}
            >
              <header className="flex items-center gap-2 border-b px-3 py-2.5">
                <span className={cn("size-2.5 rounded-full", STATUS_DOT[column.id])} aria-hidden />
                <h2 className="font-semibold">
                  {column.label}{" "}
                  <span className="tabular font-normal text-muted-foreground">
                    {inColumn.length}
                  </span>
                </h2>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {shown.map((task) => {
                  const editable = canEdit(task);
                  return (
                    <li
                      key={task.id}
                      draggable={editable}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, task.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className={cn(
                        "rounded-md border bg-card p-3 shadow-[0_1px_0_rgb(28_36_52/0.04)]",
                        editable && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/work/tasks/${task.id}`}
                          className={cn(
                            "min-w-0 rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
                            task.status === "done" &&
                              "font-normal text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </Link>
                        {editable ? (
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
                                onValueChange={(value) => void moveTask(task, value as TaskStatus)}
                              >
                                {TASK_STATUSES.map((option) => (
                                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                                    {option.label}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                      {showProject && task.projectId ? (
                        <p className="truncate text-caption text-muted-foreground">
                          {projectName(task.projectId)}
                        </p>
                      ) : null}
                      <TaskMeta task={task} className="mt-1.5" />
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {task.priority === "high" && task.status !== "done" ? (
                            <PriorityBadge priority="high" short />
                          ) : null}
                          <DueLabel task={task} />
                        </span>
                        <AssigneeStack ids={task.assigneeIds} />
                      </div>
                    </li>
                  );
                })}
                {inColumn.length > shown.length ? (
                  <li className="px-2 py-1 text-center text-caption text-muted-foreground">
                    And {inColumn.length - shown.length} more in the list view.
                  </li>
                ) : null}
                <li className="mt-auto">
                  <QuickAddTask status={column.id} projectId={projectId} className="w-full" />
                </li>
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
