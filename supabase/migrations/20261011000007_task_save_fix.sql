-- save_task clears or keeps tasks.assignee_id on every update, which named
-- the column in the UPDATE and fired the legacy sync trigger even when the
-- value didn't change: editing only a description could reset a task's
-- assignees to its old single assignee. Fire it only on a real change, and
-- stop save_task touching the column when assignees aren't being saved.
-- Safe to run more than once.

drop trigger if exists tasks_legacy_assignee on public.tasks;
drop trigger if exists tasks_legacy_assignee_insert on public.tasks;
drop trigger if exists tasks_legacy_assignee_change on public.tasks;
create trigger tasks_legacy_assignee_insert after insert on public.tasks
  for each row
  when (new.assignee_id is not null)
  execute function private.sync_legacy_assignee();
create trigger tasks_legacy_assignee_change after update of assignee_id on public.tasks
  for each row
  when (new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id)
  execute function private.sync_legacy_assignee();
