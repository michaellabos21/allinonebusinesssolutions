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

  /** Notifications arrive in a later phase; until then the list is empty. */
  notifications: Notification[];
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

const NO_NOTIFICATIONS: Notification[] = [];

export function DemoStoreProvider({
  account,
  records,
  children,
}: {
  account: Account;
  records: WorkspaceRecords;
  children: React.ReactNode;
}) {
  const [appearance, setAppearanceState] = useState<Appearance>({
    accent: "indigo",
    density: "comfortable",
  });
  const [editor, setEditor] = useState<DemoStore["editor"]>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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

      notifications: NO_NOTIFICATIONS,
      markNotificationRead: () => {},
      markAllNotificationsRead: () => {},

      editor,
      openQuickCreate: (kind, preset) => setEditor({ kind, preset }),
      openEditor: (kind, id) => setEditor({ kind, id }),
      closeEditor: () => setEditor(null),

      searchOpen,
      setSearchOpen,
    };
  }, [account, records, appearance, editor, searchOpen]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const store = useContext(DemoStoreContext);
  if (!store) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return store;
}
