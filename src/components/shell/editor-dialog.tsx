"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  type FormFailure,
  type FormOption,
  type FormResult,
  type FormSpec,
  NONE,
  RecordForm,
} from "@/components/common/record-form";
import { type EditorKind, useDemoStore } from "@/components/providers/demo-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DEMO_TODAY } from "@/config/app";
import { addDays, formatAmountInput, parseAmountToMinor } from "@/lib/format";
import { getRuntime, getToday } from "@/lib/runtime";
import { useFocusReturn } from "@/lib/use-focus-return";
import {
  saveCatalogItemAction,
  saveCompanyAction,
  saveContactAction,
  saveProjectAction,
  saveTaskAction,
} from "@/server/actions/records";
import type { ActionResult } from "@/server/types";
import {
  CONTACT_TAGS,
  DEAL_STAGES,
  type DealStage,
  EXPENSE_CATEGORIES,
  TASK_STATUSES,
} from "@/mocks";

/**
 * Turns a server action's result into what the form expects. `rename` maps
 * the action's field names to the form's where they differ.
 */
function outcome(
  result: ActionResult<{ id: string; name: string }>,
  onSaved: (saved: { id: string; name: string }) => FormResult,
  rename: Record<string, string> = {},
): FormResult | FormFailure {
  if (result.ok && result.data) return onSaved(result.data);
  if (result.ok) return { error: "The server didn’t confirm the save. Reload and check." };
  const fieldErrors = Object.fromEntries(
    Object.entries(result.fieldErrors ?? {}).map(([name, message]) => [
      rename[name] ?? name,
      message,
    ]),
  );
  return { error: result.error, fieldErrors };
}

const optional = (options: FormOption[], label: string) => [{ value: NONE, label }, ...options];
const orNull = (value: string) => (value === NONE || !value ? null : value);
const parseTags = (text: string) => [
  ...new Set(
    text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

/** Builds the form for a record type; with an id it edits that record. */
function useFormSpec(kind: EditorKind, id?: string): FormSpec | null {
  const store = useDemoStore();
  const activeContacts = store.contacts.filter((contact) => !contact.archived);
  const activeCompanies = store.companies.filter((company) => !company.archived);
  const contactOptions = activeContacts.map((contact) => {
    const company = store.companyName(contact.companyId);
    return { value: contact.id, label: company ? `${contact.name}, ${company}` : contact.name };
  });
  const memberOptions = store.team.map((member) => ({ value: member.id, label: member.name }));

  switch (kind) {
    case "contact": {
      const contact = store.contacts.find((item) => item.id === id);
      if (id && !contact) return null;
      return {
        title: contact ? "Edit contact" : "New contact",
        description: contact ? `Update details for ${contact.name}.` : "Add someone you work with.",
        submitLabel: contact ? "Save changes" : "Add contact",
        fields: [
          {
            name: "name",
            label: "Full name",
            type: "text",
            required: true,
            missing: "Enter the contact’s name.",
            placeholder: "Ana Cruz",
          },
          {
            name: "email",
            label: "Email",
            type: "email",
            required: true,
            missing: "Enter an email address.",
            placeholder: "ana@company.com",
            half: true,
          },
          { name: "phone", label: "Phone", type: "tel", placeholder: "0917 555 0100", half: true },
          {
            name: "title",
            label: "Job title",
            type: "text",
            placeholder: "Operations manager",
            half: true,
          },
          {
            name: "companyName",
            label: "Company",
            type: "combo",
            placeholder: "Pick one or type a new name",
            options: activeCompanies.map((company) => ({
              value: company.name,
              label: company.name,
            })),
            half: true,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            half: true,
            options: [
              { value: "active", label: "Active" },
              { value: "lead", label: "Lead" },
              { value: "inactive", label: "Inactive" },
            ],
          },
          {
            name: "tags",
            label: "Tags",
            type: "text",
            placeholder: CONTACT_TAGS.slice(0, 2).join(", "),
            hint: "Separate tags with commas.",
          },
        ],
        initial: {
          name: contact?.name ?? "",
          email: contact?.email ?? "",
          phone: contact?.phone ?? "",
          title: contact?.title ?? "",
          companyName: store.companyName(contact?.companyId ?? null),
          status: contact?.status ?? "active",
          tags: contact?.tags.join(", ") ?? "",
        },
        check: (v) => {
          const email = v.email.trim().toLowerCase();
          const clash = store.contacts.find(
            (item) => item.id !== id && item.email.toLowerCase() === email,
          );
          return clash ? { email: `${clash.name} already uses this email.` } : {};
        },
        submit: async (v) =>
          outcome(
            await saveContactAction(
              {
                name: v.name,
                email: v.email,
                phone: v.phone,
                title: v.title,
                companyName: v.companyName,
                status: v.status,
                tags: parseTags(v.tags),
              },
              id,
            ),
            (saved) => ({
              message: contact
                ? `Changes to ${saved.name} saved`
                : `${saved.name} added to contacts`,
              viewLabel: "View contact",
              href: `/crm/contacts/${saved.id}`,
            }),
          ),
      };
    }
    case "company": {
      const company = store.companies.find((item) => item.id === id);
      if (id && !company) return null;
      return {
        title: company ? "Edit company" : "New company",
        description: company
          ? `Update details for ${company.name}.`
          : "Add an organisation you work with or are pitching to.",
        submitLabel: company ? "Save changes" : "Add company",
        fields: [
          {
            name: "name",
            label: "Company name",
            type: "text",
            required: true,
            missing: "Enter the company’s name.",
            placeholder: "Cruz Trading",
          },
          {
            name: "type",
            label: "Relationship",
            type: "select",
            required: true,
            half: true,
            options: [
              { value: "client", label: "Client" },
              { value: "prospect", label: "Prospect" },
            ],
          },
          { name: "industry", label: "Industry", type: "text", placeholder: "Retail", half: true },
          { name: "city", label: "City", type: "text", placeholder: "Iloilo City", half: true },
          {
            name: "website",
            label: "Website",
            type: "text",
            placeholder: "company.com",
            half: true,
          },
          { name: "phone", label: "Phone", type: "tel", placeholder: "033 555 0100", half: true },
          { name: "address", label: "Address", type: "text", placeholder: "Street, city" },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
            placeholder: "Anything worth remembering about this company.",
          },
        ],
        initial: {
          name: company?.name ?? "",
          type: company?.type ?? "client",
          industry: company?.industry ?? "",
          city: company?.city ?? "",
          website: company?.website ?? "",
          phone: company?.phone ?? "",
          address: company?.address ?? "",
          notes: company?.notes ?? "",
        },
        check: (v) => {
          const name = v.name.trim().toLowerCase();
          const clash = store.companies.some(
            (item) => item.id !== id && item.name.toLowerCase() === name,
          );
          return clash ? { name: "A company with this name already exists." } : {};
        },
        submit: async (v) =>
          outcome(
            await saveCompanyAction(
              {
                name: v.name,
                type: v.type,
                industry: v.industry,
                city: v.city,
                website: v.website,
                phone: v.phone,
                address: v.address,
                notes: v.notes,
              },
              id,
            ),
            (saved) => ({
              message: company
                ? `Changes to ${saved.name} saved`
                : `${saved.name} added to companies`,
              viewLabel: "View company",
              href: `/crm/companies/${saved.id}`,
            }),
          ),
      };
    }
    case "deal": {
      const deal = store.deals.find((item) => item.id === id);
      if (id && !deal) return null;
      return {
        title: deal ? "Edit deal" : "New deal",
        description: deal
          ? `Update “${deal.name}”.`
          : "Track an opportunity from first contact to a decision.",
        submitLabel: deal ? "Save changes" : "Add deal",
        warning:
          activeCompanies.length === 0
            ? "Add a company first. A deal belongs to a company."
            : undefined,
        fields: [
          {
            name: "name",
            label: "Deal name",
            type: "text",
            required: true,
            missing: "Give the deal a name.",
            placeholder: "Website redesign",
          },
          {
            name: "companyId",
            label: "Company",
            type: "select",
            required: true,
            missing: "Choose the company this deal is with.",
            half: true,
            options: activeCompanies.map((company) => ({ value: company.id, label: company.name })),
          },
          {
            name: "contactId",
            label: "Contact",
            type: "select",
            half: true,
            options: (values) =>
              optional(
                activeContacts
                  .filter((contact) => !values.companyId || contact.companyId === values.companyId)
                  .map((contact) => ({ value: contact.id, label: contact.name })),
                "No contact",
              ),
          },
          {
            name: "value",
            label: `Value (${getRuntime().currency})`,
            type: "amount",
            required: true,
            missing: "Enter what the deal is worth.",
            placeholder: "120,000",
            half: true,
          },
          {
            name: "stage",
            label: "Stage",
            type: "select",
            required: true,
            half: true,
            options: DEAL_STAGES.map((stage) => ({ value: stage.id, label: stage.label })),
          },
          {
            name: "ownerId",
            label: "Owner",
            type: "select",
            required: true,
            half: true,
            options: memberOptions,
          },
          {
            name: "expectedCloseOn",
            label: "Expected close",
            type: "date",
            required: true,
            missing: "Choose an expected close date.",
            half: true,
          },
        ],
        initial: {
          name: deal?.name ?? "",
          companyId: deal?.companyId ?? "",
          contactId: deal?.contactId ?? NONE,
          value: deal ? formatAmountInput(deal.valueMinor) : "",
          stage: deal?.stage ?? "lead",
          ownerId: deal?.ownerId ?? store.account.user.id,
          expectedCloseOn: deal?.expectedCloseOn ?? addDays(DEMO_TODAY, 30),
        },
        check: (v) => {
          const contact = activeContacts.find((item) => item.id === v.contactId);
          return contact && contact.companyId !== v.companyId
            ? { contactId: "Choose a contact from the selected company." }
            : {};
        },
        submit: (v) => {
          const saved = store.saveDeal(
            {
              name: v.name.trim(),
              companyId: v.companyId,
              contactId: orNull(v.contactId),
              ownerId: v.ownerId,
              stage: v.stage as DealStage,
              valueMinor: parseAmountToMinor(v.value) ?? 0,
              expectedCloseOn: v.expectedCloseOn,
            },
            id,
          );
          return {
            message: deal ? `Changes to “${saved.name}” saved` : `Deal “${saved.name}” added`,
            viewLabel: "View deals",
            href: "/crm/deals",
          };
        },
      };
    }
    case "project": {
      const project = store.projects.find((item) => item.id === id);
      if (id && !project) return null;
      return {
        title: project ? "Edit project" : "New project",
        description: project
          ? `Update “${project.name}”.`
          : "Start a project and give it an owner and a due date.",
        submitLabel: project ? "Save changes" : "Create project",
        fields: [
          {
            name: "name",
            label: "Project name",
            type: "text",
            required: true,
            missing: "Give the project a name.",
            placeholder: "Website redesign",
          },
          {
            name: "contactId",
            label: "Client",
            type: "select",
            options: optional(contactOptions, "No client"),
          },
          {
            name: "ownerId",
            label: "Owner",
            type: "select",
            required: true,
            half: true,
            options: memberOptions,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            half: true,
            options: [
              { value: "active", label: "Active" },
              { value: "on_hold", label: "On hold" },
              { value: "completed", label: "Completed" },
            ],
          },
          {
            name: "dueOn",
            label: "Due date",
            type: "date",
            required: true,
            missing: "Choose a due date.",
            half: true,
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            placeholder: "What is being delivered, and for whom?",
          },
        ],
        initial: {
          name: project?.name ?? "",
          contactId: project?.contactId ?? NONE,
          ownerId: project?.ownerId ?? store.account.user.id,
          status: project?.status ?? "active",
          dueOn: project?.dueOn ?? addDays(getToday(), 30),
          description: project?.description ?? "",
        },
        submit: async (v) =>
          outcome(
            await saveProjectAction(
              {
                name: v.name,
                description: v.description,
                contactId: orNull(v.contactId),
                ownerId: v.ownerId,
                status: v.status,
                dueOn: v.dueOn,
              },
              id,
            ),
            (saved) => ({
              message: project
                ? `Changes to “${saved.name}” saved`
                : `Project “${saved.name}” created`,
              viewLabel: "View project",
              href: `/work/projects/${saved.id}`,
            }),
          ),
      };
    }
    case "task": {
      const task = store.tasks.find((item) => item.id === id);
      if (id && !task) return null;
      return {
        title: task ? "Edit task" : "New task",
        description: task
          ? "Update this task."
          : "Add something that needs doing and who is doing it.",
        submitLabel: task ? "Save changes" : "Add task",
        fields: [
          {
            name: "title",
            label: "Task",
            type: "text",
            required: true,
            missing: "Describe the task.",
            placeholder: "Send the first draft",
          },
          {
            name: "projectId",
            label: "Project",
            type: "select",
            options: optional(
              store.projects.map((project) => ({
                value: project.id,
                label:
                  project.status === "completed" ? `${project.name} (completed)` : project.name,
              })),
              "No project",
            ),
          },
          {
            name: "assigneeId",
            label: "Assignee",
            type: "select",
            required: true,
            half: true,
            options: memberOptions,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            half: true,
            options: TASK_STATUSES.map((status) => ({ value: status.id, label: status.label })),
          },
          {
            name: "dueOn",
            label: "Due date",
            type: "date",
            required: true,
            missing: "Choose a due date.",
            half: true,
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            required: true,
            half: true,
            options: [
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ],
          },
          {
            name: "description",
            label: "Notes",
            type: "textarea",
            placeholder: "Anything the assignee should know.",
          },
        ],
        initial: {
          title: task?.title ?? "",
          projectId: task?.projectId ?? NONE,
          assigneeId: task?.assigneeId ?? store.account.user.id,
          status: task?.status ?? "todo",
          dueOn: task?.dueOn ?? addDays(getToday(), 2),
          priority: task?.priority ?? "medium",
          description: task?.description ?? "",
        },
        submit: async (v) =>
          outcome(
            await saveTaskAction(
              {
                title: v.title,
                description: v.description,
                projectId: orNull(v.projectId),
                assigneeId: v.assigneeId,
                status: v.status,
                priority: v.priority,
                dueOn: v.dueOn,
              },
              id,
            ),
            (saved) => ({
              message: task ? `Changes to “${saved.name}” saved` : `Task “${saved.name}” added`,
              viewLabel: "View tasks",
              href: "/work/tasks",
            }),
          ),
      };
    }
    case "invoice":
      return {
        title: "New invoice",
        description:
          "A one-line draft. Open it afterwards to add more lines, a discount or tax. Nothing is sent to the client.",
        submitLabel: "Save draft",
        warning:
          contactOptions.length === 0
            ? "Add a contact first. An invoice needs a client to bill."
            : undefined,
        fields: [
          {
            name: "contactId",
            label: "Client",
            type: "select",
            required: true,
            missing: "Choose a client to bill.",
            options: contactOptions,
          },
          {
            name: "description",
            label: "Description",
            type: "text",
            required: true,
            missing: "Describe what the invoice is for.",
            placeholder: "Design work, October",
          },
          {
            name: "amount",
            label: `Amount (${getRuntime().currency})`,
            type: "amount",
            required: true,
            missing: "Enter the invoice amount.",
            placeholder: "25,000",
            half: true,
          },
          {
            name: "dueOn",
            label: "Due date",
            type: "date",
            required: true,
            missing: "Choose a due date.",
            half: true,
          },
        ],
        initial: { contactId: "", description: "", amount: "", dueOn: addDays(DEMO_TODAY, 15) },
        submit: (v) => {
          const invoice = store.addInvoice({
            contactId: v.contactId,
            description: v.description.trim(),
            amountMinor: parseAmountToMinor(v.amount) ?? 0,
            dueOn: v.dueOn,
          });
          return {
            message: `Draft ${invoice.number} saved`,
            viewLabel: "Open draft",
            href: `/money/invoices/${invoice.id}`,
          };
        },
      };
    case "catalog": {
      const item = store.catalog.find((entry) => entry.id === id);
      if (id && !item) return null;
      return {
        title: item ? "Edit catalog item" : "New catalog item",
        description: item
          ? `Update “${item.name}”.`
          : "Add a product or service you bill for, with its usual rate.",
        submitLabel: item ? "Save changes" : "Add item",
        fields: [
          {
            name: "name",
            label: "Name",
            type: "text",
            required: true,
            missing: "Give the item a name.",
            placeholder: "Page design",
          },
          {
            name: "type",
            label: "Type",
            type: "select",
            required: true,
            half: true,
            options: [
              { value: "service", label: "Service" },
              { value: "product", label: "Product" },
            ],
          },
          {
            name: "unit",
            label: "Unit",
            type: "text",
            required: true,
            missing: "Say what one unit is, like hour or page.",
            placeholder: "hour",
            half: true,
          },
          {
            name: "price",
            label: `Unit price (${getRuntime().currency})`,
            type: "amount",
            required: true,
            missing: "Enter the price for one unit.",
            placeholder: "2,500",
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            placeholder: "What the client gets.",
          },
        ],
        initial: {
          name: item?.name ?? "",
          type: item?.type ?? "service",
          unit: item?.unit ?? "",
          price: item ? formatAmountInput(item.unitPriceMinor) : "",
          description: item?.description ?? "",
        },
        check: (v) => {
          const name = v.name.trim().toLowerCase();
          const clash = store.catalog.some(
            (entry) => entry.id !== id && entry.name.toLowerCase() === name,
          );
          return clash ? { name: "An item with this name already exists." } : {};
        },
        submit: async (v) =>
          outcome(
            await saveCatalogItemAction(
              {
                name: v.name,
                type: v.type,
                unit: v.unit,
                unitPriceMinor: parseAmountToMinor(v.price) ?? 0,
                description: v.description,
              },
              id,
            ),
            (saved) => ({
              message: item
                ? `Changes to “${saved.name}” saved`
                : `“${saved.name}” added to the catalog`,
            }),
            { unitPriceMinor: "price" },
          ),
      };
    }
    case "expense": {
      const expense = store.expenses.find((entry) => entry.id === id);
      if (id && !expense) return null;
      return {
        title: expense ? "Edit expense" : "New expense",
        description: expense ? "Update this expense." : "Record something the business paid for.",
        submitLabel: expense ? "Save changes" : "Add expense",
        fields: [
          {
            name: "vendor",
            label: "Paid to",
            type: "text",
            required: true,
            missing: "Enter who was paid.",
            placeholder: "Panay Print House",
            half: true,
          },
          {
            name: "date",
            label: "Date",
            type: "date",
            required: true,
            missing: "Choose the date it was paid.",
            half: true,
          },
          {
            name: "amount",
            label: `Amount (${getRuntime().currency})`,
            type: "amount",
            required: true,
            missing: "Enter the amount paid.",
            placeholder: "1,500",
            half: true,
          },
          {
            name: "category",
            label: "Category",
            type: "select",
            required: true,
            missing: "Choose a category.",
            half: true,
            options: EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
          },
          {
            name: "description",
            label: "What it was for",
            type: "text",
            required: true,
            missing: "Say what this was for.",
            placeholder: "Printed proofs for the catalog",
          },
          {
            name: "projectId",
            label: "Project",
            type: "select",
            options: optional(
              store.projects.map((project) => ({ value: project.id, label: project.name })),
              "No project",
            ),
          },
        ],
        initial: {
          vendor: expense?.vendor ?? "",
          date: expense?.date ?? DEMO_TODAY,
          amount: expense ? formatAmountInput(expense.amountMinor) : "",
          category: expense?.category ?? "",
          description: expense?.description ?? "",
          projectId: expense?.projectId ?? NONE,
        },
        check: (v) =>
          v.date > DEMO_TODAY ? { date: "An expense can’t be dated in the future." } : {},
        submit: (v) => {
          const saved = store.saveExpense(
            {
              vendor: v.vendor.trim(),
              date: v.date,
              amountMinor: parseAmountToMinor(v.amount) ?? 0,
              category: v.category,
              description: v.description.trim(),
              projectId: orNull(v.projectId),
            },
            id,
          );
          return {
            message: expense
              ? `Expense from ${saved.vendor} updated`
              : `Expense from ${saved.vendor} recorded`,
          };
        },
      };
    }
  }
}

function EditorForm({
  kind,
  id,
  preset,
  onDone,
}: {
  kind: EditorKind;
  id?: string;
  preset?: Record<string, string>;
  onDone: () => void;
}) {
  const router = useRouter();
  const spec = useFormSpec(kind, id);
  if (!spec) return null;

  return (
    <RecordForm
      spec={{ ...spec, initial: { ...spec.initial, ...preset } }}
      onCancel={onDone}
      onSaved={(result) => {
        const href = result.href;
        toast.success(result.message, {
          description: "Kept for this session only.",
          action:
            href && result.viewLabel
              ? { label: result.viewLabel, onClick: () => router.push(href) }
              : undefined,
        });
        onDone();
      }}
    />
  );
}

/** One dialog for every create and edit form; mounted once in the app shell. */
export function EditorDialog() {
  const { editor, closeEditor } = useDemoStore();
  const returnFocus = useFocusReturn(editor !== null);
  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={returnFocus}
      >
        {editor ? (
          <EditorForm
            key={`${editor.kind}-${editor.id ?? "new"}`}
            kind={editor.kind}
            id={editor.id}
            preset={editor.preset}
            onDone={closeEditor}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
