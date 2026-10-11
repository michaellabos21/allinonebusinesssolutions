"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import { PageSkeleton } from "@/components/common/page-skeleton";
import { type Account, DemoStoreProvider, useDemoStore } from "@/components/providers/demo-store";
import { GlobalSearch } from "@/components/shell/global-search";
import { EditorDialog } from "@/components/shell/editor-dialog";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ACCENTS, CURRENCY_OPTIONS, WORKSPACE_DEFAULTS } from "@/config/app";
import { applyRuntime } from "@/lib/runtime";
import type { NotificationFeed } from "@/mocks/types";
import type { WorkspaceRecords } from "@/server/records";
import { useFocusReturn } from "@/lib/use-focus-return";
import { cn } from "@/lib/utils";

/**
 * Workspace frame: a sidebar on the canvas and a white working surface that
 * holds the topbar and page. Below `lg` the sidebar moves into a drawer.
 */
export function AppShell({
  account,
  records,
  notifications,
  children,
}: {
  account: Account;
  records: WorkspaceRecords;
  notifications: NotificationFeed;
  children: React.ReactNode;
}) {
  return (
    // Keyed on the workspace: switching workspace starts the sample records afresh.
    <DemoStoreProvider
      key={account.workspace.id}
      account={account}
      records={records}
      notifications={notifications}
    >
      <ShellFrame>{children}</ShellFrame>
    </DemoStoreProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { appearance, account, team } = useDemoStore();
  const returnFocus = useFocusReturn(mobileNavOpen);

  // Formatting helpers are plain functions, so the workspace's currency and the
  // user's date preferences are mirrored into `lib/runtime` on the client. The
  // page renders only once they are applied, and remounts when they change, so
  // no amount or date is ever drawn with another setting.
  const { workspace, user } = account;
  const runtimeKey = [
    workspace.id,
    workspace.currency,
    workspace.taxRateBps,
    workspace.paymentTermDays,
    user.dateFormat,
    user.weekStartsOn,
    workspace.timezone,
    team.map((member) => `${member.id}:${member.name}`).join(","),
  ].join("|");
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  useLayoutEffect(() => {
    applyRuntime({
      currency: workspace.currency,
      locale:
        CURRENCY_OPTIONS.find((option) => option.code === workspace.currency)?.locale ??
        WORKSPACE_DEFAULTS.locale,
      taxRateBps: workspace.taxRateBps,
      paymentTermDays: workspace.paymentTermDays,
      dateLocale: user.dateFormat === "mdy" ? "en-US" : "en-GB",
      weekStartsOn: user.weekStartsOn,
      timezone: workspace.timezone,
      team,
    });
    // Syncing React with the module-level runtime is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppliedKey(runtimeKey);
  }, [runtimeKey, workspace, user, team]);

  // Appearance settings are applied to the document root so that menus and
  // dialogs, which render outside this tree, pick them up too.
  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENTS.find((item) => item.id === appearance.accent) ?? ACCENTS[0];
    root.style.setProperty("--primary", accent.primary);
    root.style.setProperty("--primary-hover", accent.hover);
    root.style.setProperty("--primary-soft", accent.soft);
    root.style.setProperty("--ring", accent.primary);
    root.dataset.density = appearance.density;
  }, [appearance]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-popover"
      >
        Skip to content
      </a>

      {/* The print: classes unwind the shell so a document prints on its own. */}
      <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden print:block print:h-auto print:overflow-visible">
        <aside
          className={cn(
            "hidden shrink-0 transition-[width] duration-200 lg:block print:hidden",
            collapsed ? "w-[60px]" : "w-60",
          )}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-72 gap-0 bg-canvas p-0"
            onCloseAutoFocus={returnFocus}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Workspace pages</SheetDescription>
            </SheetHeader>
            <Sidebar inDrawer onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2 print:block print:p-0">
          <div className="flex min-h-0 flex-1 flex-col bg-background lg:overflow-hidden lg:rounded-xl lg:border print:block print:overflow-visible print:border-0">
            <Topbar
              sidebarCollapsed={collapsed}
              onToggleSidebar={() => setCollapsed((value) => !value)}
              onOpenMobileNav={() => setMobileNavOpen(true)}
            />
            {/* `relative` makes this scroll area the containing block for visually hidden
                (absolutely positioned) labels, so they cannot stretch the document. */}
            <main
              key={runtimeKey}
              id="main-content"
              tabIndex={-1}
              className="relative flex-1 outline-none lg:overflow-y-auto print:overflow-visible"
            >
              {appliedKey === runtimeKey ? children : <PageSkeleton />}
            </main>
          </div>
        </div>
      </div>

      <GlobalSearch />
      <EditorDialog />
    </>
  );
}
