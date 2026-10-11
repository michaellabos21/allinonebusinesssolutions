"use client";

import { Check, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { toast } from "sonner";

import { PriorityBadge } from "@/components/common/status-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
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
import { describeDue, formatDate } from "@/lib/format";
import { setTaskStatus } from "@/lib/record-actions";
import { useFocusReturn } from "@/lib/use-focus-return";
import { memberName } from "@/lib/work";
import { TASK_STATUSES, type TaskStatus } from "@/mocks";

/** Side panel with one task's details. Used by the tasks, project and calendar screens. */
export function TaskPanel({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { tasks, projects, openEditor } = useDemoStore();
  const statusId = useId();
  const task = tasks.find((item) => item.id === taskId) ?? null;
  const project = projects.find((item) => item.id === task?.projectId);
  const due = task ? describeDue(task.dueOn) : null;
  const returnFocus = useFocusReturn(task !== null);

  async function changeStatus(status: TaskStatus) {
    if (!task || task.status === status) return;
    if (!(await setTaskStatus(task.id, status))) return;
    const label = TASK_STATUSES.find((item) => item.id === status)?.label;
    toast.success(status === "done" ? "Task completed" : `Task moved to ${label}`, {
      description: task.title,
    });
  }

  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md" onCloseAutoFocus={returnFocus}>
        {task ? (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="font-display text-lg">{task.title}</SheetTitle>
              <SheetDescription>
                {project ? (
                  <Link
                    href={`/work/projects/${project.id}`}
                    onClick={onClose}
                    className="hover:text-foreground hover:underline"
                  >
                    {project.name}
                  </Link>
                ) : (
                  "No project"
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="grid gap-1.5">
                <Label htmlFor={statusId}>Status</Label>
                <Select
                  value={task.status}
                  onValueChange={(value) => changeStatus(value as TaskStatus)}
                >
                  <SelectTrigger id={statusId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <dt className="text-caption text-muted-foreground">Assignee</dt>
                  <dd className="mt-0.5 flex items-center gap-2">
                    <UserAvatar name={memberName(task.assigneeId)} className="size-6" />
                    {memberName(task.assigneeId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Priority</dt>
                  <dd className="mt-0.5">
                    <PriorityBadge priority={task.priority} short />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-caption text-muted-foreground">Due</dt>
                  <dd className="tabular">
                    {formatDate(task.dueOn, "weekday")}
                    {task.status !== "done" && due?.tone === "overdue" ? (
                      <span className="ml-2 font-medium text-danger">{due.label}</span>
                    ) : null}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-caption text-muted-foreground">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">
                    {task.description || <span className="text-muted-foreground">No notes.</span>}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2 border-t p-4">
              {task.status === "done" ? (
                <Button variant="outline" onClick={() => changeStatus("todo")}>
                  <RotateCcw data-icon="inline-start" aria-hidden />
                  Reopen
                </Button>
              ) : (
                <Button className="hover:bg-primary-hover" onClick={() => changeStatus("done")}>
                  <Check data-icon="inline-start" aria-hidden />
                  Mark as done
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  openEditor("task", task.id);
                }}
              >
                <Pencil data-icon="inline-start" aria-hidden />
                Edit
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
