"use client";

import { Handshake } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { useDemoStore } from "@/components/providers/demo-store";
import { formatMoney } from "@/lib/format";
import { getOpenDeals, getPipeline } from "@/lib/metrics";

/** Open deal value by stage. Bars share one scale so stages compare directly. */
export function PipelineSummary() {
  const { deals, stages: allStages } = useDemoStore();
  const stages = getPipeline(deals, allStages);
  const openCount = getOpenDeals(deals).length;
  const totalMinor = stages.reduce((sum, stage) => sum + stage.valueMinor, 0);
  const maxMinor = Math.max(...stages.map((stage) => stage.valueMinor), 1);

  return (
    <Panel
      title="Pipeline"
      description={
        openCount > 0
          ? `${formatMoney(totalMinor)} across ${openCount} open ${openCount === 1 ? "deal" : "deals"}.`
          : "Open deals by stage."
      }
      action={
        <Link href="/crm/deals" className="text-caption font-medium text-primary hover:underline">
          View deals
        </Link>
      }
    >
      {openCount === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No open deals"
          description="Add a deal, or convert a lead, to see your pipeline here."
        />
      ) : (
        <ul className="space-y-4 pt-1">
          {stages.map((stage) => (
            <li key={stage.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{stage.label}</span>
                <span className="tabular">{formatMoney(stage.valueMinor)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-sm bg-muted" aria-hidden>
                <div
                  className="h-full rounded-sm bg-[var(--chart-1)]"
                  style={{ width: `${Math.max((stage.valueMinor / maxMinor) * 100, 1.5)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
