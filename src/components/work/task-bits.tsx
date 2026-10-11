"use client";

import { Check, ChevronDown, UserPlus } from "lucide-react";

import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeDue, formatDate } from "@/lib/format";
import { getToday, memberName, memberPhoto } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/mocks";
import { can } from "@/server/permissions";

/** A coloured dot per status, shared by group headers, board columns and the status menu. */
export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground/50",
  in_progress: "bg-primary",
  in_review: "bg-warning",
  done: "bg-success",
};

export const statusLabel = (status: TaskStatus) =>
  TASK_STATUSES.find((item) => item.id === status)?.label ?? status;

/**
 * Whether the signed-in user may change a task: managers and above, its
 * creator, and its assignees. The database checks the same rule
 * (`private.can_edit_task`); this only decides what the screen offers.
 */
export function useCanEditTask() {
  const { account } = useDemoStore();
  const me = account.user.id;
  const manager = can(account.workspace.role, "records.archive");
  return (task: Task) => manager || task.createdBy === me || task.assigneeIds.includes(me);
}

/** Up to three overlapping photos, then "+N". */
export function AssigneeStack({
  ids,
  size = "sm",
  className,
}: {
  ids: string[];
  size?: "sm" | "md";
  className?: string;
}) {
  const names = ids.map(memberName);
  const label = ids.length ? `Assigned to ${names.join(", ")}` : "Unassigned";
  if (ids.length === 0) {
    return (
      <span className={cn("text-caption text-muted-foreground", className)} title={label}>
        <span className="sr-only">{label}</span>
        <span aria-hidden>—</span>
      </span>
    );
  }
  const shown = ids.slice(0, 3);
  const avatar = size === "sm" ? "size-6 [&_[data-slot=avatar-fallback]]:text-[10px]" : "size-7";
  return (
    <span className={cn("flex items-center", className)} title={label}>
      <span className="sr-only">{label}</span>
      <span className="flex -space-x-1.5" aria-hidden>
        {shown.map((id) => (
          <UserAvatar
            key={id}
            name={memberName(id)}
            photoPath={memberPhoto(id)}
            className={cn(avatar, "ring-2 ring-card")}
          />
        ))}
      </span>
      {ids.length > shown.length ? (
        <span className="ml-1 text-caption text-muted-foreground" aria-hidden>
          +{ids.length - shown.length}
        </span>
      ) : null}
    </span>
  );
}

/** "Due today", "2 days overdue", or the date once done; nothing when there is no due date. */
export function DueLabel({ task, className }: { task: Task; className?: string }) {
  if (!task.dueOn) {
    return <span className={cn("text-caption text-muted-foreground", className)}>No due date</span>;
  }
  const done = task.status === "done";
  const due = describeDue(task.dueOn, getToday());
  return (
    <span
      className={cn(
        "tabular text-caption whitespace-nowrap",
        !done && due.tone === "overdue"
          ? "font-medium text-danger"
          : !done && due.tone === "today"
            ? "font-medium text-warning"
            : "text-muted-foreground",
        className,
      )}
    >
      {done ? formatDate(task.dueOn) : due.label}
    </span>
  );
}

/** A status button that opens a menu of the four statuses. */
export function StatusMenu({
  status,
  onChange,
  disabled,
  label,
  className,
}: {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
  /** Accessible name; defaults to "Status: <current>". */
  label?: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          size="sm"
          aria-label={label ?? `Status: ${statusLabel(status)}`}
          className={cn("gap-2", className)}
        >
          <span className={cn("size-2 rounded-full", STATUS_DOT[status])} aria-hidden />
          {statusLabel(status)}
          {disabled ? null : <ChevronDown aria-hidden className="opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => onChange(value as TaskStatus)}
        >
          {TASK_STATUSES.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <span className={cn("size-2 rounded-full", STATUS_DOT[option.id])} aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pick any number of teammates. Changes apply as each person is ticked. */
export function AssigneePicker({
  ids,
  onChange,
  disabled,
}: {
  ids: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { team, account } = useDemoStore();
  const me = account.user.id;
  const people = [...team].sort((a, b) =>
    a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name),
  );
  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          className="h-auto min-h-8 w-full justify-start gap-2 px-2 py-1"
          aria-label={
            ids.length ? `Assignees: ${ids.map(memberName).join(", ")}` : "Assignees: none"
          }
        >
          {ids.length ? (
            <AssigneeStack ids={ids} size="md" />
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <UserPlus aria-hidden />
              Unassigned
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Assign people</DropdownMenuLabel>
        {people.map((member) => (
          <DropdownMenuCheckboxItem
            key={member.id}
            checked={ids.includes(member.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(member.id)}
          >
            <UserAvatar
              name={member.name}
              photoPath={member.photoPath}
              className="size-5 [&_[data-slot=avatar-fallback]]:text-[10px]"
            />
            <span className="truncate">
              {member.name}
              {member.id === me ? " (you)" : ""}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {ids.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => onChange([])}>
              <Check aria-hidden className="opacity-0" />
              Remove everyone
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
