"use client";

import { useEffect, useState } from "react";

import { DemoStoreProvider, useDemoStore } from "@/components/providers/demo-store";
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
import { ACCENTS } from "@/config/app";
import { useFocusReturn } from "@/lib/use-focus-return";
import { cn } from "@/lib/utils";

/**
 * Workspace frame: a sidebar on the canvas and a white working surface that
 * holds the topbar and page. Below `lg` the sidebar moves into a drawer.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoStoreProvider>
      <ShellFrame>{children}</ShellFrame>
    </DemoStoreProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { appearance, settingsVersion } = useDemoStore();
  const returnFocus = useFocusReturn(mobileNavOpen);

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

      <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 transition-[width] duration-200 lg:block",
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
              <SheetDescription>Workspace pages and demo data settings</SheetDescription>
            </SheetHeader>
            <Sidebar inDrawer onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
          <div className="flex min-h-0 flex-1 flex-col bg-background lg:overflow-hidden lg:rounded-xl lg:border">
            <Topbar
              sidebarCollapsed={collapsed}
              onToggleSidebar={() => setCollapsed((value) => !value)}
              onOpenMobileNav={() => setMobileNavOpen(true)}
            />
            {/* `relative` makes this scroll area the containing block for visually hidden
                (absolutely positioned) labels, so they cannot stretch the document. */}
            {/* Keyed on settingsVersion: a currency, date or profile change remounts
                the page so every formatted value is re-read. */}
            <main
              key={settingsVersion}
              id="main-content"
              tabIndex={-1}
              className="relative flex-1 outline-none lg:overflow-y-auto"
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <GlobalSearch />
      <EditorDialog />
    </>
  );
}
