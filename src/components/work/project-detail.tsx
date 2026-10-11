"use client";

import { Activity, FolderKanban, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { SegmentedControl } from "@/components/common/table-toolbar";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import { useDemoStore } from "@/components/providers/demo-store";
import { getToday } from "@/lib/runtime";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/work/progress-bar";
import { TaskBoard } from "@/components/work/task-board";
import { TaskList } from "@/components/work/task-list";
import { daysBetween, formatDate, formatRelativeDay } from "@/lib/format";
import { getProjectProgress, getProjectTeam, memberName } from "@/lib/work";
import { cn } from "@/lib/utils";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const today = getToday();
  const [view, setView] = useState<"list" | "board">("list");

  const project = store.projects.find((item) => item.id === id);
  if (!project) {
    return (
      <MissingRecord
        icon={FolderKanban}
        noun="project"
        listHref="/work/projects"
        listLabel="Back to projects"
      />
    );
  }

  const tasks = store.tasks.filter((task) => task.projectId === project.id);
  const progress = getProjectProgress(project.id, store.tasks);
  const team = getProjectTeam(project, store.tasks);
  const activity = store.activity.filter((entry) => entry.projectId === project.id);
  const contact = store.contacts.find((item) => item.id === project.contactId);
  const client = store.contactCompanyName(project.contactId);
  const daysLeft = daysBetween(today, project.dueOn);

  const figures = [
    {
      label: "Progress",
      value: `${progress.percent}%`,
      note:
        progress.total === 0
          ? "No tasks yet."
          : `${progress.done} of ${progress.total} tasks done.`,
    },
    {
      label: "Open tasks",
      value: String(progress.open),
      note: progress.overdue > 0 ? `${progress.overdue} overdue.` : "None overdue.",
      alert: progress.overdue > 0,
    },
    {
      label: "Due",
      value: formatDate(project.dueOn),
      note:
        project.status === "completed"
          ? "Project completed."
          : daysLeft < 0
            ? `${Math.abs(daysLeft)} days past the due date.`
            : daysLeft === 0
              ? "Due today."
              : `${daysLeft} days left.`,
      alert: project.status === "active" && daysLeft < 0,
    },
  ];

  return (
    <div className="page-container space-y-6">
      <BackLink href="/work/projects" label="Projects" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-title">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {contact ? (
              <>
                For{" "}
                <Link
                  href={`/crm/contacts/${contact.id}`}
                  className="hover:text-foreground hover:underline"
                >
                  {contact.name}
                </Link>
                {client ? (
                  <>
                    {" at "}
                    <Link
                      href={`/crm/companies/${contact.companyId}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {client}
                    </Link>
                  </>
                ) : null}
              </>
            ) : (
              "No client"
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => store.openEditor("project", project.id)}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit
          </Button>
          <Button
            className="hover:bg-primary-hover"
            onClick={() => store.openQuickCreate("task", { projectId: project.id })}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add task
          </Button>
        </div>
      </header>

      <section aria-label="Summary" className="overflow-hidden rounded-lg border bg-card">
        <dl className="grid sm:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.label} className="-mt-px -ml-px border-t border-l px-5 py-4">
              <dt className="text-muted-foreground">{figure.label}</dt>
              <dd className="mt-1">
                <span className="block font-display text-figure">{figure.value}</span>
                <span
                  className={cn(
                    "mt-1 block text-caption",
                    figure.alert ? "font-medium text-danger" : "text-muted-foreground",
                  )}
                >
                  {figure.note}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t px-5 py-3">
          <ProgressBar done={progress.done} total={progress.total} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="project-tasks-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="project-tasks-title" className="font-semibold">
                  Tasks
                </h2>
                <p className="text-caption text-muted-foreground">
                  {progress.open} open, {progress.done} done.
                </p>
              </div>
              <SegmentedControl
                label="View"
                options={[
                  { value: "list", label: "List" },
                  { value: "board", label: "Board" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
            {view === "list" ? (
              <TaskList tasks={tasks} projectId={project.id} showProject={false} />
            ) : (
              <TaskBoard tasks={tasks} projectId={project.id} showProject={false} />
            )}
          </section>

          <Panel
            title="Activity"
            description="Changes to this project and its tasks."
            bodyClassName="px-2 pb-2"
          >
            {activity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Task and project changes are logged here."
              />
            ) : (
              <ol>
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <p>
                      <span className="font-medium">{entry.actor}</span>{" "}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </p>
                    <span className="tabular shrink-0 text-caption text-muted-foreground">
                      {formatRelativeDay(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Overview">
            <p className="max-w-[60ch]">
              {project.description || (
                <span className="text-muted-foreground">No description yet.</span>
              )}
            </p>
            <dl className="mt-4 space-y-3 border-t pt-4">
              <div>
                <dt className="text-caption text-muted-foreground">Owner</dt>
                <dd>{memberName(project.ownerId)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Started</dt>
                <dd className="tabular">{formatDate(project.startOn, "long")}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Due</dt>
                <dd className="tabular">{formatDate(project.dueOn, "long")}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Team" description="The owner and everyone with a task here.">
            <ul className="space-y-3">
              {team.map(({ member, isOwner, openTasks }) => (
                <li key={member.id} className="flex items-center gap-3">
                  <UserAvatar name={member.name} photoPath={member.photoPath} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {isOwner ? "Project owner" : "Contributor"}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-caption text-muted-foreground">
                    {openTasks} open
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
