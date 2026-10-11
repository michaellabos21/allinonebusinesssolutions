"use client";

import { ListChecks, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Panel } from "@/components/common/panel";
import { UserAvatar } from "@/components/common/user-avatar";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CommentBody, CommentComposer } from "@/components/work/comment-composer";
import { AssigneePicker, DueLabel, StatusMenu, useCanEditTask } from "@/components/work/task-bits";
import { formatRelativeDay } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { getRuntime, memberName, memberPhoto } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority } from "@/mocks";
import {
  addChecklistItemAction,
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
  removeChecklistItemAction,
  updateChecklistItemAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { TaskComment, TaskDetail } from "@/server/task-detail";

const NO_PROJECT = "none";

/** "Today, 3:42 PM" or "12 Oct, 9:05 AM". */
function when(iso: string) {
  const time = new Intl.DateTimeFormat(getRuntime().dateLocale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: getRuntime().timezone,
  }).format(new Date(iso));
  return `${formatRelativeDay(iso.slice(0, 10))}, ${time}`;
}

/** Saves a change to the task and reports a refusal. */
const save = (taskId: string, patch: Record<string, unknown>) =>
  runAction(updateTaskAction(taskId, patch));

export function TaskPage({ taskId, detail }: { taskId: string; detail: TaskDetail }) {
  const store = useDemoStore();
  const canEdit = useCanEditTask();
  const task = store.tasks.find((item) => item.id === taskId);

  if (!task) {
    return (
      <MissingRecord
        icon={ListChecks}
        noun="task"
        listHref="/work/tasks"
        listLabel="Back to tasks"
      />
    );
  }
  const editable = canEdit(task);
  const project = store.projects.find((item) => item.id === task.projectId);

  return (
    <div className="page-container space-y-5">
      <BackLink
        href={project ? `/work/projects/${project.id}` : "/work/tasks"}
        label={project ? project.name : "Tasks"}
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu
            status={task.status}
            disabled={!editable}
            onChange={(status) => void save(task.id, { status })}
          />
          <DueLabel task={task} />
        </div>
        <TitleField key={task.title} task={task} editable={editable} />
        {!editable ? (
          <p className="text-caption text-muted-foreground">
            You can comment here. Only managers, the person who added this task and its assignees
            can change it.
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <DescriptionField key={task.description} task={task} editable={editable} />
          <Checklist task={task} items={detail.checklist} editable={editable} />
          <Comments task={task} comments={detail.comments} />
          <History entries={detail.history} />
        </div>

        <aside
          aria-label="Task details"
          className="space-y-1 self-start rounded-lg border bg-card p-3"
        >
          <Detail label="Assignees">
            <AssigneePicker
              ids={task.assigneeIds}
              disabled={!editable}
              onChange={(assigneeIds) => void save(task.id, { assigneeIds })}
            />
          </Detail>
          <Detail label="Due date" htmlFor="task-due">
            <DueField task={task} editable={editable} />
          </Detail>
          <Detail label="Priority" htmlFor="task-priority">
            <Select
              value={task.priority}
              disabled={!editable}
              onValueChange={(priority) =>
                void save(task.id, { priority: priority as TaskPriority })
              }
            >
              <SelectTrigger id="task-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </Detail>
          <Detail label="Project" htmlFor="task-project">
            <Select
              value={task.projectId ?? NO_PROJECT}
              disabled={!editable}
              onValueChange={(value) =>
                void save(task.id, { projectId: value === NO_PROJECT ? null : value })
              }
            >
              <SelectTrigger id="task-project" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {store.projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Detail>
          <Detail label="Added by">
            <p className="px-2 py-1.5">{task.createdBy ? memberName(task.createdBy) : "Unknown"}</p>
          </Detail>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div className="grid gap-1 px-1 py-1.5">
      <Tag htmlFor={htmlFor} className="px-1 text-caption text-muted-foreground">
        {label}
      </Tag>
      {children}
    </div>
  );
}

function TitleField({ task, editable }: { task: Task; editable: boolean }) {
  const [title, setTitle] = useState(task.title);
  if (!editable) return <h1 className="font-display text-title">{task.title}</h1>;

  async function commit() {
    const next = title.trim();
    if (!next) return setTitle(task.title);
    if (next !== task.title && !(await save(task.id, { title: next }))) setTitle(task.title);
  }
  return (
    <h1>
      <label htmlFor="task-title" className="sr-only">
        Task name
      </label>
      <Input
        id="task-title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitle(task.title);
            event.currentTarget.blur();
          }
        }}
        className="h-auto border-transparent px-1 py-1 font-display text-title shadow-none hover:border-input md:text-title"
      />
    </h1>
  );
}

function DescriptionField({ task, editable }: { task: Task; editable: boolean }) {
  const [text, setText] = useState(task.description);
  const dirty = text !== task.description;

  return (
    <Panel title="Description">
      {editable ? (
        <div className="grid gap-2">
          <label htmlFor="task-description" className="sr-only">
            Description
          </label>
          <Textarea
            id="task-description"
            value={text}
            rows={4}
            maxLength={2000}
            placeholder="What needs doing, links, anything the team should know."
            onChange={(event) => setText(event.target.value)}
          />
          {dirty ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setText(task.description)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (await save(task.id, { description: text }))
                    toast.success("Description saved");
                }}
              >
                Save description
              </Button>
            </div>
          ) : null}
        </div>
      ) : task.description ? (
        <p className="whitespace-pre-wrap">{task.description}</p>
      ) : (
        <p className="text-muted-foreground">No description.</p>
      )}
    </Panel>
  );
}

function DueField({ task, editable }: { task: Task; editable: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <Input
        id="task-due"
        type="date"
        value={task.dueOn ?? ""}
        disabled={!editable}
        onChange={(event) => void save(task.id, { dueOn: event.target.value || null })}
        className="flex-1"
      />
      {editable && task.dueOn ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear the due date"
          onClick={() => void save(task.id, { dueOn: null })}
        >
          <X aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function Checklist({
  task,
  items,
  editable,
}: {
  task: Task;
  items: TaskDetail["checklist"];
  editable: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const done = items.filter((item) => item.done).length;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    if (await runAction(addChecklistItemAction({ taskId: task.id, body }))) setDraft("");
    setBusy(false);
  }

  return (
    <Panel
      title="Checklist"
      description={items.length ? `${done} of ${items.length} done` : "Break the task into steps."}
    >
      {items.length ? (
        <>
          <div className="mb-3 h-1.5 rounded-sm bg-muted" aria-hidden>
            <div
              className="h-full rounded-sm bg-success transition-[width]"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-1">
            {items.map((item) => (
              <ChecklistRow key={`${item.id}-${item.done}`} item={item} editable={editable} />
            ))}
          </ul>
        </>
      ) : null}
      {editable ? (
        <form onSubmit={add} className={cn("flex gap-2", items.length && "mt-3")}>
          <label htmlFor={id} className="sr-only">
            New checklist item
          </label>
          <Input
            id={id}
            value={draft}
            maxLength={300}
            placeholder="Add a step"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={busy || !draft.trim()}>
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        </form>
      ) : null}
    </Panel>
  );
}

/** One step. The tick shows at once and is undone if the save is refused. */
function ChecklistRow({
  item,
  editable,
}: {
  item: TaskDetail["checklist"][number];
  editable: boolean;
}) {
  const [done, setDone] = useState(item.done);
  return (
    <li className="group flex items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/50">
      <input
        type="checkbox"
        id={`check-${item.id}`}
        checked={done}
        disabled={!editable}
        onChange={async (event) => {
          const next = event.target.checked;
          setDone(next);
          if (!(await runAction(updateChecklistItemAction({ id: item.id, done: next })))) {
            setDone(!next);
          }
        }}
        className="size-4 accent-[var(--primary)]"
      />
      <label
        htmlFor={`check-${item.id}`}
        className={cn("flex-1", done && "text-muted-foreground line-through")}
      >
        {item.body}
      </label>
      {editable ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove “${item.body}”`}
          className="opacity-60 group-hover:opacity-100"
          onClick={() => void runAction(removeChecklistItemAction(item.id))}
        >
          <Trash2 aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

function Comments({ task, comments }: { task: Task; comments: TaskComment[] }) {
  const { account } = useDemoStore();
  const me = account.user.id;
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TaskComment | null>(null);
  const live = comments.filter((comment) => !comment.deleted).length;

  return (
    <Panel
      title="Comments"
      description={live ? `${live} ${live === 1 ? "comment" : "comments"}` : undefined}
    >
      {comments.length ? (
        <ol className="mb-5 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} id={`comment-${comment.id}`} className="flex scroll-mt-24 gap-3">
              <UserAvatar
                name={comment.authorName}
                photoPath={comment.authorId ? memberPhoto(comment.authorId) : null}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-caption text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.authorName}</span>
                  <time dateTime={comment.at}>{when(comment.at)}</time>
                  {comment.editedAt && !comment.deleted ? <span>(edited)</span> : null}
                  {comment.authorId === me && !comment.deleted && editing !== comment.id ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="ml-auto"
                          aria-label="Comment options"
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(comment.id)}>
                          <Pencil aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleting(comment)}
                        >
                          <Trash2 aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </p>
                <div className="mt-1">
                  {comment.deleted ? (
                    <p className="text-muted-foreground italic">This comment was deleted.</p>
                  ) : editing === comment.id ? (
                    <CommentComposer
                      autoFocus
                      initialBody={comment.body}
                      initialMentions={comment.mentions}
                      submitLabel="Save"
                      onCancel={() => setEditing(null)}
                      onSubmit={async (body, mentions) => {
                        const ok = await runAction(
                          editCommentAction({ id: comment.id, body, mentions }),
                        );
                        if (ok) setEditing(null);
                        return ok;
                      }}
                    />
                  ) : (
                    <CommentBody body={comment.body} mentions={comment.mentions} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-4 text-muted-foreground">No comments yet. Start the conversation.</p>
      )}

      <CommentComposer
        submitLabel="Comment"
        onSubmit={(body, mentions) =>
          runAction(addCommentAction({ taskId: task.id, body, mentions }))
        }
      />
      <p className="mt-2 text-caption text-muted-foreground">
        People you @mention, and everyone else on the task, are notified under the bell.
      </p>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this comment?"
        description="Its text is removed for everyone. The thread shows that a comment was deleted."
        confirmLabel="Delete comment"
        onConfirm={async () => {
          if (deleting && (await runAction(deleteCommentAction(deleting.id)))) {
            toast.success("Comment deleted");
          }
          setDeleting(null);
        }}
      />
    </Panel>
  );
}

function History({ entries }: { entries: TaskDetail["history"] }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const shown = open ? entries : entries.slice(0, 3);
  return (
    <Panel title="History" description="Changes to this task, newest first.">
      <ol className="space-y-2">
        {shown.map((entry) => (
          <li key={entry.id} className="text-caption">
            <span className="font-medium text-foreground">{entry.actor}</span>{" "}
            <span className="text-muted-foreground">{entry.action}</span>
            <span className="text-muted-foreground"> · {when(entry.at)}</span>
          </li>
        ))}
      </ol>
      {entries.length > 3 ? (
        <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show all ${entries.length}`}
        </Button>
      ) : null}
    </Panel>
  );
}
