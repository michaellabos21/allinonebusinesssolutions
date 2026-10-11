"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useId } from "react";

import { useDemoStore } from "@/components/providers/demo-store";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PRODUCT_NAME } from "@/config/app";
import { COMING_LATER, NAV_GROUPS, isActivePath, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
        active &&
          "bg-background font-medium text-foreground shadow-[0_0_0_1px_var(--border)] hover:bg-background",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon
        className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
        aria-hidden
      />
      {collapsed ? null : <span className="truncate">{item.title}</span>}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
}

type NavGroupsProps = { collapsed: boolean; onNavigate?: () => void };

function NavGroups({
  pathname,
  collapsed,
  onNavigate,
}: NavGroupsProps & { pathname: string | null }) {
  return (
    <>
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? "top"} className={cn(index > 0 && "mt-4")}>
          {group.label ? (
            collapsed ? (
              <div className="mx-2 mb-2 border-t" role="presentation" />
            ) : (
              <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group.label}</p>
            )
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={pathname !== null && isActivePath(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function ActiveNavGroups(props: NavGroupsProps) {
  return <NavGroups pathname={usePathname()} {...props} />;
}

/**
 * Sidebar contents, shared by the desktop rail and the mobile drawer.
 * `collapsed` renders the icon-only rail.
 */
export function Sidebar({
  collapsed = false,
  inDrawer = false,
  onNavigate,
}: {
  collapsed?: boolean;
  /** Leaves room for the drawer's close button beside the workspace switcher. */
  inDrawer?: boolean;
  onNavigate?: () => void;
}) {
  const { demoEnabled, setDemoEnabled } = useDemoStore();
  const switchId = useId();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-3 pt-3", collapsed && "px-2", inDrawer && "pr-12")}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav
        aria-label="Main"
        className={cn("relative flex-1 overflow-y-auto px-3 py-3", collapsed && "px-2")}
      >
        {/* On detail routes the pathname is only known at request time, so the
            active state streams in; the links themselves are prerendered. */}
        <Suspense
          fallback={<NavGroups pathname={null} collapsed={collapsed} onNavigate={onNavigate} />}
        >
          <ActiveNavGroups collapsed={collapsed} onNavigate={onNavigate} />
        </Suspense>

        {collapsed ? null : (
          <div className="mt-4">
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Coming later</p>
            <ul>
              {COMING_LATER.map((title) => (
                <li key={title} className="flex h-7 items-center px-2 text-muted-foreground">
                  {title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {collapsed ? null : (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={switchId} className="font-medium">
              Demo data
            </label>
            <Switch id={switchId} checked={demoEnabled} onCheckedChange={setDemoEnabled} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {demoEnabled
              ? "Invoices and expenses show sample records. Nothing there is saved yet."
              : "Sample records hidden. Anything you add there lasts until you reload."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {PRODUCT_NAME}: your account, team, contacts, companies, leads, deals, catalog, projects
            and tasks are saved.
          </p>
        </div>
      )}
    </div>
  );
}
