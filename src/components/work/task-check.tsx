"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import { cn } from "@/lib/utils";
import type { Task } from "@/mocks";

/** Tick box that completes or reopens a task, with an undo on completion. */
export function TaskCheck({ task, className }: { task: Task; className?: string }) {
  const { toggleTaskDone } = useDemoStore();
  const done = task.status === "done";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” as done`}
      onClick={() => {
        toggleTaskDone(task.id);
        if (!done) {
          toast.success("Task completed", {
            description: task.title,
            action: { label: "Undo", onClick: () => toggleTaskDone(task.id) },
          });
        }
      }}
      className={cn(
        // The pseudo-element widens the click target to 26px without growing the box.
        "group relative flex size-4.5 shrink-0 items-center justify-center rounded-sm border outline-none after:absolute after:-inset-1 focus-visible:ring-3 focus-visible:ring-ring/50",
        done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:border-primary",
        className,
      )}
    >
      <Check
        className={cn("size-3", done ? "opacity-100" : "text-primary opacity-0 group-hover:opacity-100")}
        aria-hidden
      />
    </button>
  );
}
