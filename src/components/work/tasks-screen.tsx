"use client";

import { ListChecks, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import {
  FilterMenu,
  SearchInput,
  SegmentedControl,
  TableToolbar,
} from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { TaskBoard } from "@/components/work/task-board";
import { TaskList } from "@/components/work/task-list";
import { isTaskOverdue } from "@/lib/work";
import type { Task } from "@/mocks";

type View = "list" | "board";

const PRIORITY_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/** Filters shared by the tasks page and a project's task list. */
export function useTaskFilters(tasks: Task[]) {
  const { team, account, projectName } = useDemoStore();
  const me = account.user.id;
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");

  const assigneeOptions = [
    { value: "all", label: "Anyone" },
    { value: "me", label: "Me" },
    { value: "none", label: "Unassigned" },
    ...team
      .filter((member) => member.id !== me)
      .map((member) => ({ value: member.id, label: member.name })),
  ];

  const matching = useMemo(() => {
    const text = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (priority !== "all" && task.priority !== priority) return false;
      if (assignee === "me" && !task.assigneeIds.includes(me)) return false;
      if (assignee === "none" && task.assigneeIds.length > 0) return false;
      if (!["all", "me", "none"].includes(assignee) && !task.assigneeIds.includes(assignee))
        return false;
      return (
        !text ||
        [task.title, task.description, projectName(task.projectId)].some((value) =>
          value.toLowerCase().includes(text),
        )
      );
    });
  }, [tasks, query, priority, assignee, me, projectName]);

  const hasFilters = query !== "" || assignee !== "all" || priority !== "all";
  const controls = (
    <>
      <SearchInput value={query} onChange={setQuery} label="Search tasks" />
      <FilterMenu
        label="Assignee"
        options={assigneeOptions}
        value={assignee}
        onChange={setAssignee}
      />
      <FilterMenu
        label="Priority"
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={setPriority}
      />
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setQuery("");
            setAssignee("all");
            setPriority("all");
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </>
  );
  return { matching, controls, hasFilters };
}

export function TasksScreen() {
  const { tasks, projects, account, openQuickCreate } = useDemoStore();
  const me = account.user.id;
  const [view, setView] = useState<View>("list");
  const [project, setProject] = useState("all");

  const inProject = useMemo(
    () =>
      project === "all"
        ? tasks
        : tasks.filter((task) =>
            project === "none" ? !task.projectId : task.projectId === project,
          ),
    [tasks, project],
  );
  const { matching, controls, hasFilters } = useTaskFilters(inProject);

  const mine = tasks.filter((task) => task.status !== "done" && task.assigneeIds.includes(me));
  const overdue = mine.filter((task) => isTaskOverdue(task)).length;
  const projectOptions = [
    { value: "all", label: "All projects" },
    { value: "none", label: "No project" },
    ...projects.map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Tasks"
        description={
          tasks.length
            ? `${mine.length} open ${mine.length === 1 ? "task is" : "tasks are"} yours${overdue ? `, ${overdue} overdue` : ""}.`
            : "Plan the work, assign it, and talk it through on each task."
        }
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("task")}>
            <Plus data-icon="inline-start" aria-hidden />
            New task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Add a task, assign it to people on your team, and discuss it in its comments."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("task")}>
                New task
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            {controls}
            <FilterMenu
              label="Project"
              options={projectOptions}
              value={project}
              onChange={setProject}
            />
            <div className="ml-auto">
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
          </TableToolbar>

          {view === "list" ? (
            <TaskList
              tasks={matching}
              projectId={project !== "all" && project !== "none" ? project : null}
              emptyHint={hasFilters ? "No tasks match these filters." : undefined}
            />
          ) : (
            <TaskBoard
              tasks={matching}
              projectId={project !== "all" && project !== "none" ? project : null}
            />
          )}
        </>
      )}
    </div>
  );
}
