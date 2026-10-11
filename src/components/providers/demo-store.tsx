"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { type AccentId, DEMO_TODAY } from "@/config/app";
import { computeInvoiceTotals } from "@/lib/money";
import * as seed from "@/mocks";
import type {
  ActivityEntry,
  ActivityKind,
  CatalogItem,
  Company,
  CompanyType,
  Contact,
  ContactStatus,
  Deal,
  DealStage,
  Expense,
  Invoice,
  InvoiceItem,
  Note,
  Notification,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
} from "@/mocks";
import type { InvitationRow, SessionUser, SessionWorkspace, TeamMemberRow } from "@/server/types";

/**
 * Client state for the workspace screens.
 *
 * Two kinds of data meet here:
 *   - `account` is real. It is loaded on the server for the signed-in user and
 *     changed only through server actions.
 *   - Everything else (contacts, projects, invoices and so on) is still demo
 *     data from `src/mocks`, held in memory and reset on reload. Each domain
 *     moves to the database in its own backend phase; until then the UI labels
 *     it as demo data.
 */

/** Record types with a create/edit form. */
export type EditorKind =
  "contact" | "company" | "deal" | "project" | "task" | "invoice" | "catalog" | "expense";
/** The subset offered in the topbar's Create menu and the setup checklist. */
export type QuickCreateKind = "contact" | "project" | "task" | "invoice";

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  /** Matched to an existing company by name, or created when new. Empty for none. */
  companyName: string;
  status: ContactStatus;
  tags: string[];
};
export type CompanyInput = {
  name: string;
  industry: string;
  city: string;
  website: string;
  type: CompanyType;
};
export type DealInput = {
  name: string;
  companyId: string;
  contactId: string | null;
  ownerId: string;
  stage: DealStage;
  valueMinor: number;
  expectedCloseOn: string;
};
export type ProjectInput = {
  name: string;
  description: string;
  contactId: string | null;
  ownerId: string;
  status: ProjectStatus;
  dueOn: string;
};
export type TaskInput = {
  title: string;
  description: string;
  projectId: string | null;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueOn: string;
};
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
export type CatalogItemInput = Omit<CatalogItem, "id" | "archived">;
export type ExpenseInput = Omit<Expense, "id">;

export type Account = {
  user: SessionUser;
  workspace: SessionWorkspace;
  workspaces: SessionWorkspace[];
  members: TeamMemberRow[];
  invitations: InvitationRow[];
};

type DemoStore = {
  demoEnabled: boolean;
  setDemoEnabled: (enabled: boolean) => void;

  /**
   * The real, signed-in account: user, workspace, members and invitations, as
   * loaded on the server. Changes go through server actions, not this store.
   */
  account: Account;

  /**
   * Fictional teammates who own the demo business records. They are not real
   * members; the real team is `account.members`.
   */
  team: TeamMember[];
  demoUser: TeamMember;

  /** Look and feel, kept in this browser tab only. */
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;

  /** Lists include archived records; screens decide whether to show them. */
  contacts: Contact[];
  companies: Company[];
  deals: Deal[];
  notes: Note[];
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  catalog: CatalogItem[];
  expenses: Expense[];
  activity: ActivityEntry[];
  /** Counts of records added this session, for the getting-started checklist. */
  created: Record<QuickCreateKind, number>;

  /** Display helpers that tolerate missing or archived records. */
  companyName: (companyId: string | null) => string;
  contactCompanyName: (contactId: string | null) => string;

  /** Pass an id to edit, omit it to create. */
  saveContact: (input: ContactInput, id?: string) => Contact;
  setContactArchived: (id: string, archived: boolean) => void;
  saveCompany: (input: CompanyInput, id?: string) => Company;
  setCompanyArchived: (id: string, archived: boolean) => void;
  saveDeal: (input: DealInput, id?: string) => Deal;
  moveDeal: (id: string, stage: DealStage) => void;
  setDealArchived: (id: string, archived: boolean) => void;
  addNote: (contactId: string, body: string) => void;

  saveProject: (input: ProjectInput, id?: string) => Project;
  saveTask: (input: TaskInput, id?: string) => Task;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  addInvoice: (input: NewInvoice) => Invoice;
  /** Creates a draft, or updates one. Sent and paid invoices are not editable. */
  saveInvoice: (input: InvoiceInput, id?: string) => Invoice;
  /** Simulated: nothing is emailed to the client. */
  markInvoiceSent: (id: string) => void;
  /** Simulated: records the invoice as paid today. No money moves. */
  recordInvoicePayment: (id: string) => void;
  saveCatalogItem: (input: CatalogItemInput, id?: string) => CatalogItem;
  setCatalogItemArchived: (id: string, archived: boolean) => void;
  saveExpense: (input: ExpenseInput, id?: string) => Expense;
  removeExpense: (id: string) => void;
  toggleTaskDone: (id: string) => void;

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
const NEW_PREFIX = "new-";
/** Records added this session carry a `new-` id; everything else is demo data. */
const isCreated = (record: { id: string }) => record.id.startsWith(NEW_PREFIX);

export function DemoStoreProvider({
  account,
  children,
}: {
  account: Account;
  children: React.ReactNode;
}) {
  const [demoEnabled, setDemoEnabled] = useState(true);
  const [appearance, setAppearanceState] = useState<Appearance>({
    accent: "indigo",
    density: "comfortable",
  });

  const [contacts, setContacts] = useState<Contact[]>(seed.contacts);
  const [companies, setCompanies] = useState<Company[]>(seed.companies);
  const [deals, setDeals] = useState<Deal[]>(seed.deals);
  const [notes, setNotes] = useState<Note[]>(seed.notes);
  const [projects, setProjects] = useState<Project[]>(seed.projects);
  const [tasks, setTasks] = useState<Task[]>(seed.tasks);
  const [invoices, setInvoices] = useState<Invoice[]>(seed.invoices);
  const [catalog, setCatalog] = useState<CatalogItem[]>(seed.catalogItems);
  const [expenses, setExpenses] = useState<Expense[]>(seed.expenses);
  const [activity, setActivity] = useState<ActivityEntry[]>(seed.activity);

  const [notifications, setNotifications] = useState<Notification[]>(seed.notifications);
  const [editor, setEditor] = useState<DemoStore["editor"]>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const counter = useRef(0);
  const newId = useCallback((letter: string) => {
    counter.current += 1;
    return `${NEW_PREFIX}${letter}${counter.current}`;
  }, []);

  const actorName = account.user.fullName;
  const logActivity = useCallback(
    (kind: ActivityKind, action: string, href: string, projectId?: string) => {
      const entry: ActivityEntry = {
        id: newId("a"),
        kind,
        actor: actorName,
        action,
        at: `${DEMO_TODAY}T12:00:00`,
        href,
        projectId,
      };
      setActivity((entries) => [entry, ...entries]);
    },
    [newId, actorName],
  );

  const saveCompany = useCallback(
    (input: CompanyInput, id?: string) => {
      const existing = id ? companies.find((company) => company.id === id) : undefined;
      const company: Company = existing
        ? { ...existing, ...input }
        : { id: newId("co"), createdOn: DEMO_TODAY, archived: false, ...input };
      setCompanies((list) =>
        existing
          ? list.map((item) => (item.id === company.id ? company : item))
          : [company, ...list],
      );
      logActivity(
        "company",
        existing ? `updated ${company.name}` : `added ${company.name} as a company`,
        `/crm/companies/${company.id}`,
      );
      return company;
    },
    [companies, newId, logActivity],
  );

  const saveContact = useCallback(
    (input: ContactInput, id?: string) => {
      const { companyName, ...fields } = input;
      let companyId: string | null = null;
      if (companyName) {
        const match = companies.find(
          (company) => company.name.toLowerCase() === companyName.toLowerCase(),
        );
        if (match) {
          companyId = match.id;
        } else {
          const company: Company = {
            id: newId("co"),
            name: companyName,
            industry: "",
            city: "",
            website: "",
            type: fields.status === "lead" ? "prospect" : "client",
            createdOn: DEMO_TODAY,
            archived: false,
          };
          setCompanies((list) => [company, ...list]);
          companyId = company.id;
        }
      }

      const existing = id ? contacts.find((contact) => contact.id === id) : undefined;
      const contact: Contact = existing
        ? { ...existing, ...fields, companyId }
        : { id: newId("c"), createdOn: DEMO_TODAY, archived: false, ...fields, companyId };
      setContacts((list) =>
        existing
          ? list.map((item) => (item.id === contact.id ? contact : item))
          : [contact, ...list],
      );
      logActivity(
        "contact",
        existing ? `updated ${contact.name}` : `added ${contact.name} as a contact`,
        `/crm/contacts/${contact.id}`,
      );
      return contact;
    },
    [companies, contacts, newId, logActivity],
  );

  const saveDeal = useCallback(
    (input: DealInput, id?: string) => {
      const existing = id ? deals.find((deal) => deal.id === id) : undefined;
      const deal: Deal = existing
        ? { ...existing, ...input }
        : { id: newId("d"), archived: false, ...input };
      setDeals((list) =>
        existing ? list.map((item) => (item.id === deal.id ? deal : item)) : [deal, ...list],
      );
      logActivity(
        "deal",
        existing ? `updated the deal “${deal.name}”` : `added the deal “${deal.name}”`,
        "/crm/deals",
      );
      return deal;
    },
    [deals, newId, logActivity],
  );

  const moveDeal = useCallback(
    (id: string, stage: DealStage) => {
      const deal = deals.find((item) => item.id === id);
      if (!deal || deal.stage === stage) return;
      setDeals((list) => list.map((item) => (item.id === id ? { ...item, stage } : item)));
      const label = seed.DEAL_STAGES.find((item) => item.id === stage)?.label ?? stage;
      logActivity("deal", `moved “${deal.name}” to ${label}`, "/crm/deals");
    },
    [deals, logActivity],
  );

  const setContactArchived = useCallback(
    (id: string, archived: boolean) => {
      const contact = contacts.find((item) => item.id === id);
      if (!contact) return;
      setContacts((list) => list.map((item) => (item.id === id ? { ...item, archived } : item)));
      logActivity(
        "contact",
        `${archived ? "archived" : "restored"} ${contact.name}`,
        `/crm/contacts/${id}`,
      );
    },
    [contacts, logActivity],
  );

  const setCompanyArchived = useCallback(
    (id: string, archived: boolean) => {
      const company = companies.find((item) => item.id === id);
      if (!company) return;
      setCompanies((list) => list.map((item) => (item.id === id ? { ...item, archived } : item)));
      logActivity(
        "company",
        `${archived ? "archived" : "restored"} ${company.name}`,
        `/crm/companies/${id}`,
      );
    },
    [companies, logActivity],
  );

  const setDealArchived = useCallback(
    (id: string, archived: boolean) => {
      const deal = deals.find((item) => item.id === id);
      if (!deal) return;
      setDeals((list) => list.map((item) => (item.id === id ? { ...item, archived } : item)));
      logActivity(
        "deal",
        `${archived ? "archived" : "restored"} the deal “${deal.name}”`,
        "/crm/deals",
      );
    },
    [deals, logActivity],
  );

  const addNote = useCallback(
    (contactId: string, body: string) => {
      const note: Note = {
        id: newId("n"),
        contactId,
        authorId: seed.currentUser.id,
        body,
        at: `${DEMO_TODAY}T12:00:00`,
      };
      setNotes((list) => [note, ...list]);
    },
    [newId],
  );

  const saveProject = useCallback(
    (input: ProjectInput, id?: string) => {
      const existing = id ? projects.find((project) => project.id === id) : undefined;
      const project: Project = existing
        ? { ...existing, ...input }
        : { id: newId("p"), startOn: DEMO_TODAY, ...input };
      setProjects((list) =>
        existing
          ? list.map((item) => (item.id === project.id ? project : item))
          : [project, ...list],
      );
      logActivity(
        "project",
        existing ? `updated project “${project.name}”` : `started project “${project.name}”`,
        `/work/projects/${project.id}`,
        project.id,
      );
      return project;
    },
    [projects, newId, logActivity],
  );

  const saveTask = useCallback(
    (input: TaskInput, id?: string) => {
      const existing = id ? tasks.find((task) => task.id === id) : undefined;
      const task: Task = existing ? { ...existing, ...input } : { id: newId("t"), ...input };
      setTasks((list) =>
        existing ? list.map((item) => (item.id === task.id ? task : item)) : [task, ...list],
      );
      logActivity(
        "task",
        existing ? `updated task “${task.title}”` : `added task “${task.title}”`,
        task.projectId ? `/work/projects/${task.projectId}` : "/work/tasks",
        task.projectId ?? undefined,
      );
      return task;
    },
    [tasks, newId, logActivity],
  );

  const setTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      const task = tasks.find((item) => item.id === id);
      if (!task || task.status === status) return;
      setTasks((list) => list.map((item) => (item.id === id ? { ...item, status } : item)));
      const label = seed.TASK_STATUSES.find((item) => item.id === status)?.label ?? status;
      logActivity(
        "task",
        status === "done" ? `completed “${task.title}”` : `moved “${task.title}” to ${label}`,
        task.projectId ? `/work/projects/${task.projectId}` : "/work/tasks",
        task.projectId ?? undefined,
      );
    },
    [tasks, logActivity],
  );

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
      logActivity(
        "invoice",
        existing ? `updated draft invoice ${invoice.number}` : `drafted invoice ${invoice.number}`,
        `/money/invoices/${invoice.id}`,
      );
      return invoice;
    },
    [invoices, newId, logActivity],
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

  const markInvoiceSent = useCallback(
    (id: string) => {
      const invoice = invoices.find((item) => item.id === id);
      if (!invoice || invoice.status !== "draft") return;
      setInvoices((list) =>
        list.map((item) => (item.id === id ? { ...item, status: "sent" } : item)),
      );
      logActivity("invoice", `marked invoice ${invoice.number} as sent`, `/money/invoices/${id}`);
    },
    [invoices, logActivity],
  );

  const recordInvoicePayment = useCallback(
    (id: string) => {
      const invoice = invoices.find((item) => item.id === id);
      if (!invoice || invoice.status !== "sent") return;
      setInvoices((list) =>
        list.map((item) =>
          item.id === id ? { ...item, status: "paid", paidOn: DEMO_TODAY } : item,
        ),
      );
      logActivity(
        "invoice",
        `recorded payment for invoice ${invoice.number}`,
        `/money/invoices/${id}`,
      );
    },
    [invoices, logActivity],
  );

  const saveCatalogItem = useCallback(
    (input: CatalogItemInput, id?: string) => {
      const existing = id ? catalog.find((item) => item.id === id) : undefined;
      const saved: CatalogItem = existing
        ? { ...existing, ...input }
        : { id: newId("k"), archived: false, ...input };
      setCatalog((list) =>
        existing ? list.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...list],
      );
      logActivity(
        "catalog",
        existing
          ? `updated “${saved.name}” in the catalog`
          : `added “${saved.name}” to the catalog`,
        "/catalog",
      );
      return saved;
    },
    [catalog, newId, logActivity],
  );

  const setCatalogItemArchived = useCallback(
    (id: string, archived: boolean) => {
      const item = catalog.find((entry) => entry.id === id);
      if (!item) return;
      setCatalog((list) => list.map((entry) => (entry.id === id ? { ...entry, archived } : entry)));
      logActivity(
        "catalog",
        `${archived ? "archived" : "restored"} “${item.name}” in the catalog`,
        "/catalog",
      );
    },
    [catalog, logActivity],
  );

  const saveExpense = useCallback(
    (input: ExpenseInput, id?: string) => {
      const existing = id ? expenses.find((expense) => expense.id === id) : undefined;
      const saved: Expense = existing ? { ...existing, ...input } : { id: newId("e"), ...input };
      setExpenses((list) =>
        existing ? list.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...list],
      );
      logActivity(
        "expense",
        `${existing ? "updated" : "recorded"} an expense from ${saved.vendor}`,
        "/money/expenses",
      );
      return saved;
    },
    [expenses, newId, logActivity],
  );

  const removeExpense = useCallback(
    (id: string) => {
      const expense = expenses.find((item) => item.id === id);
      if (!expense) return;
      setExpenses((list) => list.filter((item) => item.id !== id));
      logActivity("expense", `deleted an expense from ${expense.vendor}`, "/money/expenses");
    },
    [expenses, logActivity],
  );

  const toggleTaskDone = useCallback(
    (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (task) setTaskStatus(id, task.status === "done" ? "todo" : "done");
    },
    [tasks, setTaskStatus],
  );

  const value = useMemo<DemoStore>(() => {
    // With demo data off, only records added this session are visible.
    const visible = <T extends { id: string }>(records: T[]) =>
      demoEnabled ? records : records.filter(isCreated);

    const companyName = (companyId: string | null) =>
      companies.find((company) => company.id === companyId)?.name ?? "";
    const count = (records: { id: string }[]) => records.filter(isCreated).length;

    return {
      demoEnabled,
      setDemoEnabled,
      account,
      team: seed.teamMembers,
      demoUser: seed.currentUser,
      appearance,
      setAppearance: (patch) => setAppearanceState((current) => ({ ...current, ...patch })),

      contacts: visible(contacts),
      companies: visible(companies),
      deals: visible(deals),
      notes: visible(notes),
      projects: visible(projects),
      tasks: visible(tasks),
      invoices: visible(invoices),
      catalog: visible(catalog),
      expenses: visible(expenses),
      activity: visible(activity),
      created: {
        contact: count(contacts),
        project: count(projects),
        task: count(tasks),
        invoice: count(invoices),
      },

      companyName,
      contactCompanyName: (contactId) =>
        companyName(contacts.find((contact) => contact.id === contactId)?.companyId ?? null),

      saveContact,
      setContactArchived,
      saveCompany,
      setCompanyArchived,
      saveDeal,
      moveDeal,
      setDealArchived,
      addNote,
      saveProject,
      saveTask,
      setTaskStatus,
      addInvoice,
      saveInvoice,
      markInvoiceSent,
      recordInvoicePayment,
      saveCatalogItem,
      setCatalogItemArchived,
      saveExpense,
      removeExpense,
      toggleTaskDone,

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
    appearance,
    contacts,
    companies,
    deals,
    notes,
    projects,
    tasks,
    invoices,
    catalog,
    expenses,
    activity,
    notifications,
    editor,
    searchOpen,
    saveContact,
    setContactArchived,
    saveCompany,
    setCompanyArchived,
    saveDeal,
    moveDeal,
    setDealArchived,
    addNote,
    saveProject,
    saveTask,
    setTaskStatus,
    addInvoice,
    saveInvoice,
    markInvoiceSent,
    recordInvoicePayment,
    saveCatalogItem,
    setCatalogItemArchived,
    saveExpense,
    removeExpense,
    toggleTaskDone,
  ]);

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const store = useContext(DemoStoreContext);
  if (!store) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return store;
}
