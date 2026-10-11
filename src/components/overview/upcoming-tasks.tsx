"use client";

import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { PriorityBadge } from "@/components/common/status-badge";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { TaskCheck } from "@/components/work/task-check";
import { describeDue } from "@/lib/format";
import { getUpcomingTasks } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const VISIBLE_TASKS = 6;

/** Next open tasks by due date. Ticking one completes it for the session. */
export function UpcomingTasks() {
  const { tasks, projects, openQuickCreate } = useDemoStore();
  const open = getUpcomingTasks(tasks);
  const visible = open.slice(0, VISIBLE_TASKS);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "No project";

  return (
    <Panel
      title="Upcoming tasks"
      description={
        open.length > VISIBLE_TASKS
          ? `Next ${VISIBLE_TASKS} of ${open.length} open tasks.`
          : `${open.length} open ${open.length === 1 ? "task" : "tasks"}.`
      }
      action={
        <Button variant="outline" size="sm" onClick={() => openQuickCreate("task")}>
          <Plus data-icon="inline-start" aria-hidden />
          Add task
        </Button>
      }
      bodyClassName="px-2 pb-2"
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No open tasks"
          description="Add a task to see what is due next."
          action={
            <Button variant="outline" onClick={() => openQuickCreate("task")}>
              Add task
            </Button>
          }
        />
      ) : (
        <>
          <ul>
            {visible.map((task) => {
              const due = describeDue(task.dueOn);
              return (
                <li key={task.id} className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50">
                  <TaskCheck task={task} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">
                      {projectName(task.projectId)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "tabular text-caption",
                        due.tone === "overdue" && "font-medium text-danger",
                        due.tone === "today" && "font-medium text-foreground",
                        due.tone === "upcoming" && "text-muted-foreground",
                      )}
                    >
                      {due.label}
                    </span>
                    {task.priority === "high" ? <PriorityBadge priority="high" /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-3 pt-2 pb-1">
            <Link href="/work/tasks" className="text-caption font-medium text-primary hover:underline">
              View all tasks
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}
