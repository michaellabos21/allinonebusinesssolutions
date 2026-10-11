"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { AccentId } from "@/config/app";
import type {
  ActivityEntry,
  CatalogItem,
  Company,
  Contact,
  Deal,
  DealStage,
  Estimate,
  Expense,
  Invoice,
  Lead,
  LeadForm,
  Note,
  Notification,
  NotificationFeed,
  Payment,
  Project,
  Task,
  TeamMember,
} from "@/mocks";
import { ROLE_LABEL, isAssignable } from "@/server/permissions";
import type { WorkspaceRecords } from "@/server/records";
import type { InvitationRow, SessionUser, SessionWorkspace, TeamMemberRow } from "@/server/types";

/**
 * Client state for the workspace screens.
 *
 *   - `account` is the signed-in user, their workspace, members and
 *     invitations, loaded on the server.
 *   - Every business record arrives as `records`, loaded on the server for
 *     this user's role, and changes only through server actions, after which
 *     the server sends fresh lists. Nothing here is sample data.
 *   - What lives only in this tab: the open dialog, the search palette and
 *     the look-and-feel choices.
 *
 * The name predates the real backend; the store no longer holds demo data.
 */

/** Record types with a create/edit dialog. Invoices and estimates use their own editor page. */
export type EditorKind =
  "contact" | "company" | "lead" | "deal" | "project" | "task" | "catalog" | "expense";
/** The subset offered in the topbar's Create menu and the setup checklist. */
export type QuickCreateKind = "contact" | "project" | "task" | "invoice";

export type Appearance = { accent: AccentId; density: "comfortable" | "compact" };

export type Account = {
  user: SessionUser;
  workspace: SessionWorkspace;
  workspaces: SessionWorkspace[];
  members: TeamMemberRow[];
  invitations: InvitationRow[];
};

type DemoStore = {
  account: Account;
  /** Members who can own projects and be assigned tasks, in the shape the screens use. */
  team: TeamMember[];

  /** Look and feel, kept in this browser tab only. */
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;

  /** Lists include archived records; screens decide whether to show them. */
  contacts: Contact[];
  companies: Company[];
  notes: Note[];
  projects: Project[];
  tasks: Task[];
  catalog: CatalogItem[];
  activity: ActivityEntry[];
  /** Every stage, archived ones included, in pipeline order. */
  stages: DealStage[];
  /** Live stages only, in pipeline order: what boards and pickers show. */
  liveStages: DealStage[];
  deals: Deal[];
  leads: Lead[];
  /** Empty for roles that cannot manage forms. */
  leadForms: LeadForm[];
  /** Finance lists are empty for roles that cannot see finance. */
  invoices: Invoice[];
  payments: Payment[];
  estimates: Estimate[];
  expenses: Expense[];
  /** True when a list was cut off at the server's row cap. */
  recordsTruncated: boolean;

  companyName: (companyId: string | null) => string;
  contactName: (contactId: string | null) => string;
  contactCompanyName: (contactId: string | null) => string;
  projectName: (projectId: string | null) => string;
  stageOf: (stageId: string) => DealStage | undefined;

  /** The bell: the signed-in user's latest notifications, newest first. */
  notifications: Notification[];
  unreadNotifications: number;
  /** Shows a newer feed, e.g. from the bell's periodic check, if it is newer than the current one. */
  receiveNotifications: (feed: NotificationFeed) => void;
  /** Mark read in this tab straight away; the caller saves it on the server. */
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  /** The create/edit dialog that is open, if any. */
  editor: { kind: EditorKind; id?: string; preset?: Record<string, string> } | null;
  /** `preset` fills in fields, e.g. the project when adding a task from a project page. */
  openQuickCreate: (kind: EditorKind, preset?: Record<string, string>) => void;
  openEditor: (kind: EditorKind, id: string) => void;
  closeEditor: () => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
};

const DemoStoreContext = createContext<DemoStore | null>(null);

export function DemoStoreProvider({
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
  const [appearance, setAppearanceState] = useState<Appearance>({
    accent: "indigo",
    density: "comfortable",
  });
  const [editor, setEditor] = useState<DemoStore["editor"]>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // The server sends a fresh feed with every page load and refresh; the bell
  // also fetches one now and then. Whichever was read last is shown.
  const [fetchedFeed, setFetchedFeed] = useState<NotificationFeed | null>(null);
  const feed =
    fetchedFeed && fetchedFeed.loadedAt > notifications.loadedAt ? fetchedFeed : notifications;
  // Marked read in this tab: applied to the feed that was showing then, until
  // a later feed (which the bell fetches once the change is saved) replaces it.
  const [readHere, setReadHere] = useState<ReadHere>({ ids: [], all: false, feedAt: -1 });

  const value = useMemo<DemoStore>(() => {
    const nameIn = (list: { id: string; name: string }[], id: string | null) =>
      (id && list.find((record) => record.id === id)?.name) || "";
    const companyName = (id: string | null) => nameIn(records.companies, id);

    return {
      account,
      team: account.members
        .filter((member) => isAssignable(member.role))
        .map((member) => ({
          id: member.userId,
          name: member.fullName,
          email: member.email,
          title: member.jobTitle,
          photoPath: member.avatarPath,
          role: ROLE_LABEL[member.role] as TeamMember["role"],
        })),
      appearance,
      setAppearance: (patch) => setAppearanceState((current) => ({ ...current, ...patch })),

      contacts: records.contacts,
      companies: records.companies,
      notes: records.notes,
      projects: records.projects,
      tasks: records.tasks,
      catalog: records.catalog,
      activity: records.activity,
      stages: records.stages,
      liveStages: records.stages
        .filter((stage) => !stage.archived)
        .sort((a, b) => a.position - b.position),
      deals: records.deals,
      leads: records.leads,
      leadForms: records.leadForms,
      invoices: records.invoices,
      payments: records.payments,
      estimates: records.estimates,
      expenses: records.expenses,
      recordsTruncated: records.truncated,

      companyName,
      contactName: (id) => nameIn(records.contacts, id),
      contactCompanyName: (id) =>
        companyName(records.contacts.find((item) => item.id === id)?.companyId ?? null),
      projectName: (id) => nameIn(records.projects, id),
      stageOf: (id) => records.stages.find((stage) => stage.id === id),

      ...applyReadHere(feed, readHere),
      receiveNotifications: (next) =>
        setFetchedFeed((current) =>
          current && current.loadedAt >= next.loadedAt ? current : next,
        ),
      markNotificationRead: (id) =>
        setReadHere((current) =>
          current.feedAt === feed.loadedAt
            ? { ...current, ids: [...current.ids, id] }
            : { ids: [id], all: false, feedAt: feed.loadedAt },
        ),
      markAllNotificationsRead: () => setReadHere({ ids: [], all: true, feedAt: feed.loadedAt }),

      editor,
      openQuickCreate: (kind, preset) => setEditor({ kind, preset }),
      openEditor: (kind, id) => setEditor({ kind, id }),
      closeEditor: () => setEditor(null),

      searchOpen,
      setSearchOpen,
    };
  }, [account, records, feed, readHere, appearance, editor, searchOpen]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

type ReadHere = { ids: string[]; all: boolean; feedAt: number };

/** The feed with what was marked read in this tab while it was showing. */
function applyReadHere(
  feed: NotificationFeed,
  readHere: ReadHere,
): { notifications: Notification[]; unreadNotifications: number } {
  if (feed.loadedAt !== readHere.feedAt) {
    return { notifications: feed.items, unreadNotifications: feed.unread };
  }
  const notifications = feed.items.map((item) =>
    item.read || !(readHere.all || readHere.ids.includes(item.id)) ? item : { ...item, read: true },
  );
  const newlyRead =
    feed.items.filter((item) => !item.read).length -
    notifications.filter((item) => !item.read).length;
  return {
    notifications,
    unreadNotifications: readHere.all ? 0 : Math.max(0, feed.unread - newlyRead),
  };
}

export function useDemoStore() {
  const store = useContext(DemoStoreContext);
  if (!store) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return store;
}
