"use client";

import { LogOut, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { hardNavigate } from "@/components/auth/navigate";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/server/permissions";

export function UserMenu() {
  const { account } = useDemoStore();
  const { user, workspace } = account;
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.fullName}`}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={user.fullName} photoPath={user.avatarPath} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-semibold text-foreground">{user.fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {user.jobTitle ? `${user.jobTitle}, ` : ""}
            {ROLE_LABEL[workspace.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Profile and settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/team">
            <UsersRound aria-hidden />
            Team
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() =>
            startTransition(async () => {
              const result = await signOutAction();
              hardNavigate(result.ok ? (result.data?.redirectTo ?? "/login") : "/login");
            })
          }
        >
          <LogOut aria-hidden />
          {pending ? "Signing out" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
