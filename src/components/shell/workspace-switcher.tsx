"use client";

import { ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { workspace, workspaces, selectWorkspace } = useDemoStore();

  function handleSelect(id: string) {
    if (id === workspace.id) return;
    selectWorkspace(id);
    const next = workspaces.find((w) => w.id === id);
    toast.success(`Switched to ${next?.name}`, {
      description: "Demo workspaces share the same sample records.",
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Workspace: ${workspace.name}. Switch workspace`}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent",
          collapsed && "justify-center",
        )}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials(workspace.name)}
        </span>
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{workspace.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{workspace.plan}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Workspaces (demo)</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={workspace.id} onValueChange={handleSelect}>
          {workspaces.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <span className="min-w-0">
                <span className="block truncate">{option.name}</span>
                <span className="block text-xs text-muted-foreground">{option.plan}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
