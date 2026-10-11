"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { loadSampleRecordsAction } from "@/server/actions/sample-data";
import { can } from "@/server/permissions";

/**
 * Setup checklist, shown until the workspace has a contact, a project and a
 * task. Steps are in the order they depend on each other.
 */
export function GettingStarted({ sampleDataAvailable }: { sampleDataAvailable: boolean }) {
  const { contacts, projects, tasks, account, openQuickCreate } = useDemoStore();
  const [loading, startTransition] = useTransition();
  const role = account.workspace.role;

  const steps = [
    {
      kind: "contact" as const,
      title: "Add your first contact",
      description: "Start with a client you are working with now.",
      action: "Add contact",
      done: contacts.length > 0,
      allowed: can(role, "records.edit"),
    },
    {
      kind: "project" as const,
      title: "Create a project",
      description: "Group the work you are doing for that client.",
      action: "Create project",
      done: projects.length > 0,
      allowed: can(role, "projects.manage"),
    },
    {
      kind: "task" as const,
      title: "Add a task",
      description: "Write down the next thing that is due.",
      action: "Add task",
      done: tasks.length > 0,
      allowed: can(role, "records.edit"),
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const canLoadSamples = sampleDataAvailable && can(role, "projects.manage") && doneCount === 0;

  return (
    <section aria-labelledby="getting-started-title" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="getting-started-title" className="text-section">
            Set up your workspace
          </h2>
          <p className="mt-0.5 text-muted-foreground">
            {doneCount} of {steps.length} steps done. Everything you add here is saved.
          </p>
        </div>
        {canLoadSamples ? (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              startTransition(async () => {
                if (await runAction(loadSampleRecordsAction())) {
                  toast.success("Sample records added", {
                    description: "They are ordinary records: edit or archive them as you like.",
                  });
                }
              })
            }
          >
            {loading ? "Adding sample records" : "Add sample records"}
          </Button>
        ) : null}
      </div>

      <ol className="mt-4 grid border-t sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.kind}
            className="flex flex-col gap-3 border-b px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "tabular flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  step.done ? "border-success bg-success text-white" : "text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <p className="font-medium">
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </p>
            </div>
            <p className="flex-1 text-caption text-muted-foreground">{step.description}</p>
            {step.allowed ? (
              <Button
                variant={step.done ? "ghost" : "outline"}
                size="sm"
                className="self-start"
                onClick={() => openQuickCreate(step.kind)}
              >
                {step.done ? "Add another" : step.action}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">A manager or admin does this step.</p>
            )}
          </li>
        ))}
      </ol>
      {canLoadSamples ? (
        <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
          “Add sample records” is a development aid. It fills this workspace with fictional
          companies, contacts, projects and tasks so there is something to explore.
        </p>
      ) : null}
    </section>
  );
}
