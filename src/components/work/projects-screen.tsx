"use client";

import { Eye, FolderKanban, Pencil, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { FilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { getToday } from "@/lib/runtime";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/work/progress-bar";
import { formatDate } from "@/lib/format";
import { getProjectProgress, memberName } from "@/lib/work";
import type { Project } from "@/mocks";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

type ProjectRow = Project & { client: string; done: number; total: number; percent: number };

export function ProjectsScreen() {
  const { projects, tasks, team, contactCompanyName, openQuickCreate, openEditor } = useDemoStore();
  const today = getToday();
  const ownerOptions = [
    { value: "all", label: "Anyone" },
    ...team.map((member) => ({ value: member.id, label: member.name })),
  ];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");

  const rows = useMemo<ProjectRow[]>(() => {
    const text = query.trim().toLowerCase();
    return projects
      .map((project) => {
        const progress = getProjectProgress(project.id, tasks);
        return { ...project, client: contactCompanyName(project.contactId), ...progress };
      })
      .filter((project) => {
        if (status !== "all" && project.status !== status) return false;
        if (owner !== "all" && project.ownerId !== owner) return false;
        return (
          !text ||
          [project.name, project.client].some((value) => value.toLowerCase().includes(text))
        );
      });
  }, [projects, tasks, contactCompanyName, query, status, owner]);

  const columns = useMemo<Column<ProjectRow>[]>(
    () => [
      {
        id: "name",
        header: "Project",
        sortValue: (project) => project.name,
        cell: (project) => (
          <div className="min-w-40">
            <Link href={`/work/projects/${project.id}`} className="font-medium hover:underline">
              {project.name}
            </Link>
            <span className="block text-caption text-muted-foreground">
              {project.client || "No client"}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (project) => project.status,
        cell: (project) => <ProjectStatusBadge status={project.status} />,
      },
      {
        id: "owner",
        header: "Owner",
        sortValue: (project) => memberName(project.ownerId),
        className: "hidden lg:table-cell",
        cell: (project) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <UserAvatar name={memberName(project.ownerId)} className="size-6" />
            {memberName(project.ownerId)}
          </span>
        ),
      },
      {
        id: "progress",
        header: "Progress",
        sortValue: (project) => project.percent,
        className: "hidden sm:table-cell",
        cell: (project) => (
          <ProgressBar done={project.done} total={project.total} className="w-40" />
        ),
      },
      {
        id: "due",
        header: "Due",
        sortValue: (project) => project.dueOn,
        cell: (project) => {
          const late = project.status === "active" && project.dueOn < today;
          return (
            <span
              className={
                late
                  ? "tabular font-medium whitespace-nowrap text-danger"
                  : "tabular whitespace-nowrap text-muted-foreground"
              }
            >
              {formatDate(project.dueOn, "long")}
              {late ? " (late)" : ""}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (project) => (
          <RowActions
            label={`Actions for ${project.name}`}
            actions={[
              { label: "View", icon: Eye, href: `/work/projects/${project.id}` },
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("project", project.id) },
              {
                label: "Add task",
                icon: Plus,
                onSelect: () => openQuickCreate("task", { projectId: project.id }),
              },
            ]}
          />
        ),
      },
    ],
    [openEditor, openQuickCreate, today],
  );

  const table = useTableState(rows, columns, { initialSort: { id: "due", direction: "asc" } });
  const hasFilters = query !== "" || status !== "all" || owner !== "all";
  const activeCount = projects.filter((project) => project.status === "active").length;

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Projects"
        description={
          projects.length > 0
            ? `${activeCount} active of ${projects.length}. Progress is the share of each project’s tasks that are done.`
            : "Group the work you do for each client."
        }
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("project")}>
            <Plus data-icon="inline-start" aria-hidden />
            New project
          </Button>
        }
      />

      {projects.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to group tasks for a client."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("project")}>
                New project
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search projects" />
            <FilterMenu
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
            <FilterMenu label="Owner" options={ownerOptions} value={owner} onChange={setOwner} />
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setOwner("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </TableToolbar>

          <section aria-label="Projects" className="overflow-hidden rounded-lg border bg-card">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No projects match"
                description="Try a different search, or clear the filters to see every project."
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Projects"
                columns={columns}
                rows={table.pageRows}
                getRowId={(project) => project.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="projects" />
          </section>
        </>
      )}
    </div>
  );
}
