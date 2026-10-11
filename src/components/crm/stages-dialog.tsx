"use client";

import { Archive, ArrowDown, ArrowUp, Check, Plus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Pill } from "@/components/common/status-badge";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { runAction } from "@/lib/run-action";
import type { DealStage } from "@/mocks";
import {
  addStageAction,
  renameStageAction,
  reorderStagesAction,
  setStageArchivedAction,
} from "@/server/actions/sales";

/**
 * Edits the workspace's pipeline. Open stages can be renamed, reordered with
 * buttons (so it works from the keyboard) and archived once empty. Won and lost
 * stages can be renamed but always stay, last, so every deal can be closed.
 */
export function StagesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { liveStages, deals } = useDemoStore();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const addId = useId();

  const openStages = liveStages.filter((stage) => stage.kind === "open");
  const closingStages = liveStages.filter((stage) => stage.kind !== "open");

  async function run(action: () => Promise<boolean>, success?: string) {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok && success) toast.success(success);
    return ok;
  }

  function move(stage: DealStage, offset: -1 | 1) {
    const order = openStages.map((item) => item.id);
    const from = order.indexOf(stage.id);
    const to = from + offset;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    run(() => runAction(reorderStagesAction([...order, ...closingStages.map((item) => item.id)])));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline stages</DialogTitle>
          <DialogDescription>
            The columns of your deal board. Changes apply to everyone in this workspace.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2" aria-label="Stages">
          {[...openStages, ...closingStages].map((stage) => {
            const index = openStages.indexOf(stage);
            const liveDeals = deals.filter(
              (deal) => deal.stageId === stage.id && !deal.archived,
            ).length;
            return (
              <li key={stage.id} className="flex items-center gap-2 rounded-md border p-2">
                <StageName stage={stage} disabled={busy} onSave={run} />
                {stage.kind === "open" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${stage.name} earlier`}
                      disabled={busy || index === 0}
                      onClick={() => move(stage, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${stage.name} later`}
                      disabled={busy || index === openStages.length - 1}
                      onClick={() => move(stage, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        liveDeals > 0
                          ? `Archive ${stage.name} (move its ${liveDeals} deals first)`
                          : `Archive ${stage.name}`
                      }
                      disabled={busy || liveDeals > 0 || openStages.length === 1}
                      onClick={() =>
                        run(
                          () => runAction(setStageArchivedAction({ id: stage.id, archived: true })),
                          `${stage.name} archived`,
                        )
                      }
                    >
                      <Archive aria-hidden />
                    </Button>
                  </>
                ) : (
                  <Pill tone={stage.kind === "won" ? "success" : "danger"}>
                    {stage.kind === "won" ? "Won" : "Lost"}
                  </Pill>
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-caption text-muted-foreground">
          A stage can be archived once no deals are in it. Won and lost stages always stay.
        </p>

        <form
          className="flex items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!newName.trim()) return;
            if (
              await run(
                () => runAction(addStageAction({ name: newName })),
                `${newName.trim()} added`,
              )
            ) {
              setNewName("");
            }
          }}
        >
          <div className="grid flex-1 gap-1.5">
            <label htmlFor={addId} className="text-sm font-medium">
              New stage
            </label>
            <Input
              id={addId}
              value={newName}
              maxLength={40}
              placeholder="Demo booked"
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy || !newName.trim()}>
            <Plus data-icon="inline-start" aria-hidden />
            Add stage
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StageName({
  stage,
  disabled,
  onSave,
}: {
  stage: DealStage;
  disabled: boolean;
  onSave: (action: () => Promise<boolean>, success?: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(stage.name);
  const changed = name.trim() !== stage.name && name.trim() !== "";
  return (
    <form
      className="flex flex-1 items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) {
          onSave(() => runAction(renameStageAction(stage.id, { name })), "Stage renamed");
        }
      }}
    >
      <Input
        value={name}
        maxLength={40}
        aria-label={`Name of stage ${stage.name}`}
        onChange={(event) => setName(event.target.value)}
        className="h-8"
      />
      {changed ? (
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Save name for ${stage.name}`}
          disabled={disabled}
        >
          <Check aria-hidden />
        </Button>
      ) : null}
    </form>
  );
}
