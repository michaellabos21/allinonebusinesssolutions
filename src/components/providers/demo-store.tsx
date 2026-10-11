"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { type AccentId, DEMO_TODAY } from "@/config/app";
import { computeInvoiceTotals } from "@/lib/money";
import * as seed from "@/mocks";
import type {
  ActivityEntry,
  CatalogItem,
  Company,
  Contact,
  Deal,
  DealStage,
  Expense,
  Invoice,
  InvoiceItem,
  Lead,
  LeadForm,
  Note,
  Notification,
  Project,
  Task,
  TeamMember,
} from "@/mocks";
import { ROLE_LABEL, isAssignable } from "@/server/permissions";
import type { WorkspaceRecords } from "@/server/records";
import type { InvitationRow, SessionUser, SessionWorkspace, TeamMemberRow } from "@/server/types";

/**
 * Client state for the workspace screens. Three kinds of data meet here:
 *
 *   - `account` is real: the signed-in user, their workspace, members and
 *     invitations, loaded on the server.
 *   - Contacts, companies, notes, the catalog, projects, tasks and the activity
 *     feed are real too. They arrive as `records`, loaded on the server, and
 *     change only through server actions (`src/server/actions/records.ts`),
 *     after which the server sends fresh lists.
 *   - Leads, deals, pipeline stages and lead forms are real as well (Phase 3).
 *   - Invoices and expenses are still sample data from `src/mocks`, held in
 *     memory here and reset on reload. They move to the database in backend
 *     Phase 4.
 */

/** Record types with a create/edit form. */
export type EditorKind =
  "contact" | "company" | "lead" | "deal" | "project" | "task" | "invoice" | "catalog" | "expense";
/** The subset offered in the topbar's Create menu and the setup checklist. */
export type QuickCreateKind = "contact" | "project" | "task" | "invoice";

/** One-line draft from the quick-create dialog. */
export type NewInvoice = {
  contactId: string;
  description: string;
  amountMinor: number;
  dueOn: string;
};
/** Full draft from the invoice editor. */
export type InvoiceInput = {
  contactId: string;
  issuedOn: string;
  dueOn: string;
  items: Omit<InvoiceItem, "id">[];
  discountMinor: number;
  taxRateBps: number;
  notes: string;
};
export type Appearance = { accent: AccentId; density: "comfortable" | "compact" };
export type ExpenseInput = Omit<Expense, "id">;

export type Account = {
  user: SessionUser;
  workspace: SessionWorkspace;
  workspaces: SessionWorkspace[];
  members: TeamMemberRow[];
  invitations: InvitationRow[];
};

type DemoStore = {
  /** Whether the sample invoices and expenses are shown. */
  demoEnabled: boolean;
  setDemoEnabled: (enabled: boolean) => void;

  account: Account;
  /** Members who can own projects and be assigned tasks, in the shape the screens use. */
  team: TeamMember[];

  /** Look and feel, kept in this browser tab only. */
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;

  /** Real records. Lists include archived ones; screens decide whether to show them. */
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
  /** True when a list was cut off at the server's row cap. */
  recordsTruncated: boolean;

  /** Sample records. */
  invoices: Invoice[];
  expenses: Expense[];

  /**
   * Display names by id. Real records are checked first; the fallback covers
   * the fictional companies, contacts and projects that the sample invoices
   * and expenses still point at.
   */
  companyName: (companyId: string | null) => string;
  contactName: (contactId: string | null) => string;
  contactCompanyName: (contactId: string | null) => string;
  projectName: (projectId: string | null) => string;
  stageOf: (stageId: string) => DealStage | undefined;
  /** False for an id that belongs to the sample data, which has no detail page. */
  isRealRecord: (id: string | null) => boolean;

  addInvoice: (input: NewInvoice) => Invoice;
  /** Creates a draft, or updates one. Sent and paid invoices are not editable. */
  saveInvoice: (input: InvoiceInput, id?: string) => Invoice;
  /** Simulated: nothing is emailed to the client. */
  markInvoiceSent: (id: string) => void;
  /** Simulated: records the invoice as paid today. No money moves. */
  recordInvoicePayment: (id: string) => void;
  saveExpense: (input: ExpenseInput, id?: string) => Expense;
  removeExpense: (id: string) => void;

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

const FIRST_NEW_INVOICE_NUMBER = 1039;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

export function DemoStoreProvider({
  account,
  records,
  children,
}: {
  account: Account;
  records: WorkspaceRecords;
  children: React.ReactNode;
}) {
  const [demoEnabled, setDemoEnabled] = useState(true);
  const [appearance, setAppearanceState] = useState<Appearance>({
    accent: "indigo",
    density: "comfortable",
  });

  const [invoices, setInvoices] = useState<Invoice[]>(seed.invoices);
  const [expenses, setExpenses] = useState<Expense[]>(seed.expenses);
  const [notifications, setNotifications] = useState<Notification[]>(seed.notifications);

  const [editor, setEditor] = useState<DemoStore["editor"]>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const counter = useRef(0);
  const newId = useCallback((letter: string) => {
    counter.current += 1;
    return `new-${letter}${counter.current}`;
  }, []);

  const saveInvoice = useCallback(
    (input: InvoiceInput, id?: string) => {
      const existing = id ? invoices.find((invoice) => invoice.id === id) : undefined;
      const invoiceId = existing?.id ?? newId("i");
      const items = input.items.map((item, index) => ({
        ...item,
        id: `${invoiceId}-${index + 1}`,
      }));
      const totals = computeInvoiceTotals(items, input.discountMinor, input.taxRateBps);
      // Numbers continue from the highest one in use, so they never collide.
      const nextNumber =
        Math.max(
          FIRST_NEW_INVOICE_NUMBER - 1,
          ...invoices.map((item) => Number(item.number.replace(/\D/g, ""))),
        ) + 1;
      const invoice: Invoice = {
        id: invoiceId,
        number: existing?.number ?? `INV-${nextNumber}`,
        status: existing?.status ?? "draft",
        paidOn: existing?.paidOn ?? null,
        contactId: input.contactId,
        issuedOn: input.issuedOn,
        dueOn: input.dueOn,
        description: items[0]?.description ?? "",
        items,
        discountMinor: totals.discountMinor,
        taxRateBps: input.taxRateBps,
        notes: input.notes,
        amountMinor: totals.totalMinor,
      };
      setInvoices((list) =>
        existing
          ? list.map((item) => (item.id === invoice.id ? invoice : item))
          : [invoice, ...list],
      );
      return invoice;
    },
    [invoices, newId],
  );

  const addInvoice = useCallback(
    (input: NewInvoice) =>
      saveInvoice({
        contactId: input.contactId,
        issuedOn: DEMO_TODAY,
        dueOn: input.dueOn,
        items: [{ description: input.description, quantity: 1, unitPriceMinor: input.amountMinor }],
        discountMinor: 0,
        taxRateBps: 0,
        notes: "",
      }),
    [saveInvoice],
  );

  const markInvoiceSent = useCallback((id: string) => {
    setInvoices((list) =>
      list.map((item) =>
        item.id === id && item.status === "draft" ? { ...item, status: "sent" } : item,
      ),
    );
  }, []);

  const recordInvoicePayment = useCallback((id: string) => {
    setInvoices((list) =>
      list.map((item) =>
        item.id === id && item.status === "sent"
          ? { ...item, status: "paid", paidOn: DEMO_TODAY }
          : item,
      ),
    );
  }, []);

  const saveExpense = useCallback(
    (input: ExpenseInput, id?: string) => {
      const existing = id ? expenses.find((expense) => expense.id === id) : undefined;
      const saved: Expense = existing ? { ...existing, ...input } : { id: newId("e"), ...input };
      setExpenses((list) =>
        existing ? list.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...list],
      );
      return saved;
    },
    [expenses, newId],
  );

  const removeExpense = useCallback((id: string) => {
    setExpenses((list) => list.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<DemoStore>(() => {
    // With sample data off, only sample records added this session are visible.
    const sample = <T extends { id: string }>(list: T[]) =>
      demoEnabled ? list : list.filter((record) => record.id.startsWith("new-"));

    const nameIn = (lists: { id: string; name: string }[][], id: string | null) => {
      if (!id) return "";
      for (const list of lists) {
        const match = list.find((record) => record.id === id);
        if (match) return match.name;
      }
      return "";
    };
    const companyName = (id: string | null) => nameIn([records.companies, seed.companies], id);
    const contactCompanyName = (id: string | null) => {
      const contact =
        records.contacts.find((item) => item.id === id) ??
        seed.contacts.find((item) => item.id === id);
      return companyName(contact?.companyId ?? null);
    };

    return {
      demoEnabled,
      setDemoEnabled,
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
      stages: records.stages,
      liveStages: records.stages
        .filter((stage) => !stage.archived)
        .sort((a, b) => a.position - b.position),
      deals: records.deals,
      leads: records.leads,
      leadForms: records.leadForms,
      companies: records.companies,
      notes: records.notes,
      projects: records.projects,
      tasks: records.tasks,
      catalog: records.catalog,
      activity: records.activity,
      recordsTruncated: records.truncated,

      invoices: sample(invoices),
      expenses: sample(expenses),

      companyName,
      contactName: (id) => nameIn([records.contacts, seed.contacts], id),
      contactCompanyName,
      projectName: (id) => nameIn([records.projects, seed.projects], id),
      stageOf: (id) => records.stages.find((stage) => stage.id === id),
      isRealRecord: (id) => Boolean(id && UUID_PATTERN.test(id)),

      addInvoice,
      saveInvoice,
      markInvoiceSent,
      recordInvoicePayment,
      saveExpense,
      removeExpense,

      notifications: demoEnabled ? notifications : [],
      markNotificationRead: (id) =>
        setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllNotificationsRead: () =>
        setNotifications((list) => list.map((n) => ({ ...n, read: true }))),

      editor,
      openQuickCreate: (kind, preset) => setEditor({ kind, preset }),
      openEditor: (kind, id) => setEditor({ kind, id }),
      closeEditor: () => setEditor(null),

      searchOpen,
      setSearchOpen,
    };
  }, [
    demoEnabled,
    account,
    records,
    appearance,
    invoices,
    expenses,
    notifications,
    editor,
    searchOpen,
    addInvoice,
    saveInvoice,
    markInvoiceSent,
    recordInvoicePayment,
    saveExpense,
    removeExpense,
  ]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const store = useContext(DemoStoreContext);
  if (!store) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return store;
}
