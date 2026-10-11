"use client";

import { Activity, Building2, FolderKanban, Package, Wallet, Handshake, ListChecks, type LucideIcon, ReceiptText, UserRound } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { useDemoStore } from "@/components/providers/demo-store";
import { formatRelativeDay } from "@/lib/format";
import type { ActivityKind } from "@/mocks";

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  contact: UserRound,
  company: Building2,
  expense: Wallet,
  catalog: Package,
  project: FolderKanban,
  task: ListChecks,
  invoice: ReceiptText,
  deal: Handshake,
};

const VISIBLE_ENTRIES = 7;

export function RecentActivity() {
  const { activity } = useDemoStore();
  const visible = activity.slice(0, VISIBLE_ENTRIES);

  return (
    <Panel title="Recent activity" description="Latest changes across the workspace." bodyClassName="px-2 pb-2">
      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing has happened yet"
          description="New contacts, projects, tasks and invoices are logged here as you add them."
        />
      ) : (
        <ol>
          {visible.map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{entry.actor}</span>{" "}
                    <span className="text-muted-foreground">{entry.action}</span>
                  </span>
                  <span className="tabular shrink-0 text-caption text-muted-foreground">
                    {formatRelativeDay(entry.at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
