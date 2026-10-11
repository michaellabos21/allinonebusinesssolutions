"use client";

import { FolderKanban, ListChecks, type LucideIcon, Plus, ReceiptText, UserRound } from "lucide-react";

import { type QuickCreateKind, useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const QUICK_CREATE_OPTIONS: { kind: QuickCreateKind; label: string; icon: LucideIcon }[] = [
  { kind: "contact", label: "New contact", icon: UserRound },
  { kind: "project", label: "New project", icon: FolderKanban },
  { kind: "task", label: "New task", icon: ListChecks },
  { kind: "invoice", label: "New invoice", icon: ReceiptText },
];

/** Topbar button that lists the record types you can create. */
export function QuickCreateMenu() {
  const { openQuickCreate } = useDemoStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Create" className="hover:bg-primary-hover">
          <Plus data-icon="inline-start" aria-hidden />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        {QUICK_CREATE_OPTIONS.map(({ kind, label, icon: Icon }) => (
          <DropdownMenuItem key={kind} onSelect={() => openQuickCreate(kind)}>
            <Icon aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
