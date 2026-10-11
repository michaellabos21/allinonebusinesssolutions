"use client";

import { Check } from "lucide-react";

import { type QuickCreateKind, useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS: { kind: QuickCreateKind; title: string; description: string; action: string }[] = [
  {
    kind: "contact",
    title: "Add your first contact",
    description: "Start with a client you are working with now.",
    action: "Add contact",
  },
  {
    kind: "project",
    title: "Create a project",
    description: "Group the work you are doing for that client.",
    action: "Create project",
  },
  {
    kind: "task",
    title: "Add a task",
    description: "Write down the next thing that is due.",
    action: "Add task",
  },
  {
    kind: "invoice",
    title: "Draft an invoice",
    description: "Needs a contact to bill. Drafts are not sent.",
    action: "Draft invoice",
  },
];

/** Setup checklist shown while demo data is switched off. Steps are in the order they depend on each other. */
export function GettingStarted() {
  const { created, openQuickCreate, setDemoEnabled } = useDemoStore();
  const doneCount = STEPS.filter((step) => created[step.kind] > 0).length;

  return (
    <section aria-labelledby="getting-started-title" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="getting-started-title" className="text-section">
            Set up your workspace
          </h2>
          <p className="mt-0.5 text-muted-foreground">
            {doneCount === STEPS.length
              ? "All four steps done. Your overview below now runs on your own records."
              : `${doneCount} of ${STEPS.length} steps done. Demo data is off, so the overview only shows what you add.`}
          </p>
        </div>
        <Button variant="outline" onClick={() => setDemoEnabled(true)}>
          Show demo data
        </Button>
      </div>

      <ol className="mt-4 grid border-t sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => {
          const done = created[step.kind] > 0;
          return (
            <li
              key={step.kind}
              className="flex flex-col gap-3 border-b px-5 py-4 last:border-b-0 sm:odd:border-r xl:border-r xl:border-b-0 xl:last:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "tabular flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done ? "border-success bg-success text-white" : "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <p className="font-medium">
                  {step.title}
                  {done ? <span className="sr-only"> (done)</span> : null}
                </p>
              </div>
              <p className="flex-1 text-caption text-muted-foreground">{step.description}</p>
              <Button
                variant={done ? "ghost" : "outline"}
                size="sm"
                className="self-start"
                onClick={() => openQuickCreate(step.kind)}
              >
                {done ? "Add another" : step.action}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
