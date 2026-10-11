"use client";

import { Menu, PanelLeft } from "lucide-react";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { SearchTrigger } from "@/components/shell/global-search";
import { HelpDialog } from "@/components/shell/help-dialog";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { QuickCreateMenu } from "@/components/shell/quick-create";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";

export function Topbar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4 lg:static">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={sidebarCollapsed}
        onClick={onToggleSidebar}
      >
        <PanelLeft aria-hidden />
      </Button>

      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <Breadcrumbs />
        </Suspense>
      </div>

      <SearchTrigger />
      <QuickCreateMenu />
      <div className="flex items-center gap-0.5">
        <NotificationsMenu />
        <HelpDialog />
      </div>
      <UserMenu />
    </header>
  );
}
