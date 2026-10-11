import {
  Building2,
  CalendarDays,
  ChartColumn,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Package,
  ReceiptText,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** One-line description of the screen. */
  summary: string;
  /** The UI phase of the build plan that delivered this screen. */
  phase: number;
};

export type NavGroup = {
  /** Omitted for top-level items that sit outside a labelled group. */
  label?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        href: "/",
        icon: LayoutDashboard,
        summary: "A snapshot of revenue, invoices, projects and tasks.",
        phase: 1,
      },
    ],
  },
  {
    label: "CRM",
    items: [
      {
        title: "Contacts",
        href: "/crm/contacts",
        icon: UserRound,
        summary:
          "Search, filter and edit the people you work with, with notes and related records.",
        phase: 2,
      },
      {
        title: "Companies",
        href: "/crm/companies",
        icon: Building2,
        summary: "Client organisations and everyone attached to them.",
        phase: 2,
      },
      {
        title: "Leads & Deals",
        href: "/crm/deals",
        icon: Handshake,
        summary: "A stage-by-stage board for open opportunities.",
        phase: 2,
      },
    ],
  },
  {
    label: "Work",
    items: [
      {
        title: "Projects",
        href: "/work/projects",
        icon: FolderKanban,
        summary: "Project status, owners, progress and due dates.",
        phase: 3,
      },
      {
        title: "Tasks",
        href: "/work/tasks",
        icon: ListChecks,
        summary: "List and board views with status, priority and assignees.",
        phase: 3,
      },
      {
        title: "Calendar",
        href: "/work/calendar",
        icon: CalendarDays,
        summary: "Due dates and milestones laid out by week and month.",
        phase: 3,
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        title: "Invoices",
        href: "/money/invoices",
        icon: ReceiptText,
        summary: "Create invoices with line items, track status and totals.",
        phase: 4,
      },
      {
        title: "Expenses",
        href: "/money/expenses",
        icon: Wallet,
        summary: "Record and categorise business spending.",
        phase: 4,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        title: "Products & Services",
        href: "/catalog",
        icon: Package,
        summary: "Reusable items and rates for invoices.",
        phase: 4,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: ChartColumn,
        summary: "Sales, invoice, project and expense reports by date range.",
        phase: 5,
      },
      {
        title: "Team",
        href: "/team",
        icon: UsersRound,
        summary: "Members, roles and invitations.",
        phase: 5,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        summary: "Profile, workspace, currency and notification preferences.",
        phase: 5,
      },
    ],
  },
];

/** Later-stage destinations, listed once so the roadmap is visible but not clickable. */
export const COMING_LATER = ["Client portal", "Automations", "AI assistant"];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Resolves the group and item for a pathname; used by breadcrumbs. */
export function findNavEntry(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => isActivePath(pathname, entry.href));
    if (item) return { group, item };
  }
  return null;
}
