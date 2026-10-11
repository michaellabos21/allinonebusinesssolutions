"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { hardNavigate } from "@/components/auth/navigate";
import { useDemoStore } from "@/components/providers/demo-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { switchWorkspaceAction } from "@/server/actions/workspace";
import { ROLE_LABEL } from "@/server/permissions";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { account } = useDemoStore();
  const { workspace, workspaces } = account;
  const [pending, startTransition] = useTransition();

  function handleSelect(id: string) {
    if (id === workspace.id) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(id);
      if (result.ok) hardNavigate(result.data?.redirectTo ?? "/");
      else toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Workspace: ${workspace.name}. Switch workspace`}
        disabled={pending}
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
              <span className="block truncate text-xs text-muted-foreground">
                {ROLE_LABEL[workspace.role]}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={workspace.id} onValueChange={handleSelect}>
          {workspaces.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <span className="min-w-0">
                <span className="block truncate">{option.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROLE_LABEL[option.role]}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus aria-hidden />
            Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
