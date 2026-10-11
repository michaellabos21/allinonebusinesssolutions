import { DEMO_TODAY } from "@/config/app";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { getRuntime, memberName } from "@/lib/runtime";
import type { Invoice, Project, Task, TeamMember } from "@/mocks";

/** Task counts for one project. Progress is done tasks over all tasks. */
export function getProjectProgress(projectId: string, tasks: Task[], today: string = DEMO_TODAY) {
  const own = tasks.filter((task) => task.projectId === projectId);
  const done = own.filter((task) => task.status === "done").length;
  const open = own.length - done;
  return {
    total: own.length,
    done,
    open,
    overdue: own.filter((task) => task.status !== "done" && task.dueOn < today).length,
    percent: own.length === 0 ? 0 : Math.round((done / own.length) * 100),
  };
}

/** The owner plus everyone assigned a task on the project, with their open task count. */
export function getProjectTeam(project: Project, tasks: Task[]) {
  const own = tasks.filter((task) => task.projectId === project.id);
  const ids = [...new Set([project.ownerId, ...own.map((task) => task.assigneeId)])];
  return ids
    .map((id) => getRuntime().team.find((member) => member.id === id))
    .filter((member): member is TeamMember => Boolean(member))
    .map((member) => ({
      member,
      isOwner: member.id === project.ownerId,
      openTasks: own.filter((task) => task.assigneeId === member.id && task.status !== "done")
        .length,
    }));
}

export { memberName };

/** Open tasks first by due date, then finished ones, most recent first. */
export function sortTasksForList(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "done";
    const bDone = b.status === "done";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return aDone ? b.dueOn.localeCompare(a.dueOn) : a.dueOn.localeCompare(b.dueOn);
  });
}

export type CalendarEventKind = "task" | "project" | "invoice";

export type CalendarEvent = {
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  kind: CalendarEventKind;
  title: string;
  detail: string;
  /** Finished or settled; drawn struck through. */
  done: boolean;
  /** Past its date and still open. */
  late: boolean;
  taskId?: string;
  href?: string;
};

/** Everything with a due date: tasks, project deadlines and unpaid invoices. */
export function getCalendarEvents(
  {
    tasks,
    projects,
    invoices,
    clientName,
  }: {
    tasks: Task[];
    projects: Project[];
    invoices: Invoice[];
    clientName: (contactId: string | null) => string;
  },
  today: string = DEMO_TODAY,
): CalendarEvent[] {
  const projectName = (id: string | null) => projects.find((project) => project.id === id)?.name;
  return [
    ...tasks.map((task): CalendarEvent => ({
      id: `task-${task.id}`,
      date: task.dueOn,
      kind: "task",
      title: task.title,
      detail: projectName(task.projectId) ?? "No project",
      done: task.status === "done",
      late: task.status !== "done" && task.dueOn < today,
      taskId: task.id,
    })),
    ...projects.map((project): CalendarEvent => ({
      id: `project-${project.id}`,
      date: project.dueOn,
      kind: "project",
      title: `${project.name} due`,
      detail: clientName(project.contactId) || "No client",
      done: project.status === "completed",
      late: project.status === "active" && project.dueOn < today,
      href: `/work/projects/${project.id}`,
    })),
    ...invoices
      .filter((invoice) => invoice.status === "sent")
      .map((invoice): CalendarEvent => ({
        id: `invoice-${invoice.id}`,
        date: invoice.dueOn,
        kind: "invoice",
        title: `${invoice.number} payment due`,
        detail: clientName(invoice.contactId) || "Unknown client",
        done: false,
        late: invoiceDisplayStatus(invoice, today) === "overdue",
        href: `/money/invoices/${invoice.id}`,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Grid of ISO dates covering a `YYYY-MM` month in whole weeks. `weekStartsOn`: 0 Sunday, 1 Monday. */
export function getMonthGrid(monthKey: string, weekStartsOn: 0 | 1 = getRuntime().weekStartsOn) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, 1 - lead + index));
    const iso = date.toISOString().slice(0, 10);
    return { iso, day: date.getUTCDate(), inMonth: iso.startsWith(monthKey) };
  });
}

export function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function formatMonth(monthKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

/** "October" from `2026-10`. */
export function formatMonthName(monthKey: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${monthKey}-01T00:00:00Z`),
  );
}
