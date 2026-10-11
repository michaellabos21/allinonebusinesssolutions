-- Task collaboration: an "In review" status, optional due dates, several
-- assignees per task, checklists, and comments with @mentions.
--
-- Written so every statement can run again safely, and so the app version
-- before this change keeps working while it is live: tasks.assignee_id stays,
-- and when that older code sets it, the task's assignees follow (see
-- private.sync_legacy_assignee). The current app never writes assignee_id;
-- the column can be dropped once nothing older is running.

-- ---------------------------------------------------------------------------
-- Statuses, optional due date and assignee
-- ---------------------------------------------------------------------------

alter type public.task_status add value if not exists 'in_review' before 'done';

alter table public.tasks alter column due_on drop not null;
alter table public.tasks alter column assignee_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_id_workspace_key' and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_id_workspace_key unique (id, workspace_id);
  end if;
end;
$$;

create or replace function private.guard_task_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assignee_id is not null and not private.is_assignable(new.workspace_id, new.assignee_id) then
    raise exception 'assignee_not_a_member' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assignees
-- ---------------------------------------------------------------------------

create table if not exists public.task_assignees (
  task_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade
);
create index if not exists task_assignees_user_idx on public.task_assignees (user_id);
create index if not exists task_assignees_workspace_idx on public.task_assignees (workspace_id);

-- Everyone already assigned keeps their task.
insert into public.task_assignees (task_id, workspace_id, user_id, created_at)
select t.id, t.workspace_id, t.assignee_id, t.created_at
from public.tasks t
where t.assignee_id is not null
on conflict do nothing;

-- Who may change a task, its assignees and its checklist: managers and above,
-- the person who created it, and anyone assigned to it.
create or replace function private.can_edit_task(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = target_task
      and (
        private.can_manage_records(t.workspace_id)
        or (
          private.can_use_records(t.workspace_id)
          and (
            t.created_by = (select auth.uid())
            or exists (
              select 1 from public.task_assignees a
              where a.task_id = t.id and a.user_id = (select auth.uid())
            )
          )
        )
      )
  )
$$;
revoke execute on function private.can_edit_task(uuid) from public, anon;
grant execute on function private.can_edit_task(uuid) to authenticated;

create or replace function private.guard_task_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_assignable(new.workspace_id, new.user_id) then
    raise exception 'assignee_not_a_member' using errcode = '23514';
  end if;
  if (select auth.uid()) is not null then
    new.added_by := (select auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists task_assignees_guard on public.task_assignees;
create trigger task_assignees_guard before insert on public.task_assignees
  for each row execute function private.guard_task_assignment();

-- The app before this change sets tasks.assignee_id; keep its single
-- assignee in step so nothing it saves is lost.
create or replace function private.sync_legacy_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is null then
    return new;
  end if;
  delete from public.task_assignees where task_id = new.id and user_id <> new.assignee_id;
  insert into public.task_assignees (task_id, workspace_id, user_id)
  values (new.id, new.workspace_id, new.assignee_id)
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists tasks_legacy_assignee on public.tasks;
create trigger tasks_legacy_assignee after insert or update of assignee_id on public.tasks
  for each row execute function private.sync_legacy_assignee();

alter table public.task_assignees enable row level security;
revoke all on public.task_assignees from anon;
revoke update, truncate on public.task_assignees from authenticated;

drop policy if exists "Team reads assignees" on public.task_assignees;
create policy "Team reads assignees" on public.task_assignees
  for select to authenticated using (private.can_use_records(workspace_id));
drop policy if exists "Editors assign people" on public.task_assignees;
create policy "Editors assign people" on public.task_assignees
  for insert to authenticated with check (private.can_edit_task(task_id));
drop policy if exists "Editors unassign people" on public.task_assignees;
create policy "Editors unassign people" on public.task_assignees
  for delete to authenticated using (private.can_edit_task(task_id));

-- Editing a task now follows its assignees, not the single legacy column.
drop policy if exists "Edit own or managed tasks" on public.tasks;
create policy "Edit own or managed tasks" on public.tasks
  for update to authenticated
  using (private.can_edit_task(id))
  with check (private.can_use_records(workspace_id));

-- ---------------------------------------------------------------------------
-- Checklists
-- ---------------------------------------------------------------------------

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  done boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade
);
create index if not exists task_checklist_task_idx on public.task_checklist_items (task_id, position);
create index if not exists task_checklist_workspace_idx on public.task_checklist_items (workspace_id);

create or replace function private.guard_checklist_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
  end if;
  -- New items go to the end of the list.
  select coalesce(max(c.position), 0) + 1 into new.position
  from public.task_checklist_items c
  where c.task_id = new.task_id;
  return new;
end;
$$;
drop trigger if exists task_checklist_guard on public.task_checklist_items;
create trigger task_checklist_guard before insert on public.task_checklist_items
  for each row execute function private.guard_checklist_item();

alter table public.task_checklist_items enable row level security;
revoke all on public.task_checklist_items from anon;
revoke update, truncate on public.task_checklist_items from authenticated;
grant update (body, done, position) on public.task_checklist_items to authenticated;

drop policy if exists "Team reads checklists" on public.task_checklist_items;
create policy "Team reads checklists" on public.task_checklist_items
  for select to authenticated using (private.can_use_records(workspace_id));
drop policy if exists "Editors add checklist items" on public.task_checklist_items;
create policy "Editors add checklist items" on public.task_checklist_items
  for insert to authenticated with check (private.can_edit_task(task_id));
drop policy if exists "Editors change checklist items" on public.task_checklist_items;
create policy "Editors change checklist items" on public.task_checklist_items
  for update to authenticated
  using (private.can_edit_task(task_id))
  with check (private.can_edit_task(task_id));
drop policy if exists "Editors remove checklist items" on public.task_checklist_items;
create policy "Editors remove checklist items" on public.task_checklist_items
  for delete to authenticated using (private.can_edit_task(task_id));

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) <= 5000),
  -- People @mentioned, kept to active non-client members by the trigger below.
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 20),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- A deleted comment keeps its place in the thread with its text removed.
  deleted_at timestamptz,
  check (deleted_at is not null or char_length(btrim(body)) >= 1),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);
create index if not exists task_comments_workspace_idx on public.task_comments (workspace_id);

create or replace function private.guard_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.author_id := (select auth.uid());
    end if;
    new.edited_at := null;
    new.deleted_at := null;
  else
    if old.deleted_at is not null then
      raise exception 'comment_deleted' using errcode = '23514';
    end if;
    if new.deleted_at is not null then
      new.deleted_at := now();
      new.body := '';
      new.mentions := '{}';
      return new;
    end if;
    if new.body is distinct from old.body then
      new.edited_at := now();
    end if;
  end if;

  select coalesce(array_agg(distinct m), '{}') into new.mentions
  from unnest(new.mentions) as m
  where private.is_assignable(new.workspace_id, m);
  return new;
end;
$$;
drop trigger if exists task_comments_guard on public.task_comments;
create trigger task_comments_guard before insert or update on public.task_comments
  for each row execute function private.guard_comment();

alter table public.task_comments enable row level security;
revoke all on public.task_comments from anon;
revoke update, delete, truncate on public.task_comments from authenticated;
grant update (body, mentions, deleted_at) on public.task_comments to authenticated;

drop policy if exists "Team reads comments" on public.task_comments;
create policy "Team reads comments" on public.task_comments
  for select to authenticated using (private.can_use_records(workspace_id));
drop policy if exists "Team comments" on public.task_comments;
create policy "Team comments" on public.task_comments
  for insert to authenticated with check (private.can_use_records(workspace_id));
drop policy if exists "Authors edit their comments" on public.task_comments;
create policy "Authors edit their comments" on public.task_comments
  for update to authenticated
  using (author_id = (select auth.uid()) and private.can_use_records(workspace_id))
  with check (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Task history, in the activity feed
-- ---------------------------------------------------------------------------

alter table public.activities
  add column if not exists task_id uuid references public.tasks (id) on delete cascade;
create index if not exists activities_task_idx
  on public.activities (task_id, created_at desc) where task_id is not null;

-- As before, with task entries now linked to their task and its page.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_kind text;
  entry_summary text;
  entry_href text;
  entry_project uuid;
  entry_task uuid;
  is_new boolean := tg_op = 'INSERT';
  was_archived boolean := false;
  was_restored boolean := false;
begin
  -- A bulk import records one summary line itself instead of one per row.
  if current_setting('app.bulk_import', true) = 'on' then
    return new;
  end if;

  if not is_new and tg_table_name in ('contacts', 'companies', 'products_services') then
    was_archived := new.archived_at is not null and old.archived_at is null;
    was_restored := new.archived_at is null and old.archived_at is not null;
  end if;

  if tg_table_name = 'contacts' then
    entry_kind := 'contact';
    entry_href := '/crm/contacts/' || new.id;
    entry_summary := case
      when is_new then 'added ' || new.name || ' as a contact'
      when was_archived then 'archived ' || new.name
      when was_restored then 'restored ' || new.name
      else 'updated ' || new.name
    end;
  elsif tg_table_name = 'companies' then
    entry_kind := 'company';
    entry_href := '/crm/companies/' || new.id;
    entry_summary := case
      when is_new then 'added ' || new.name || ' as a company'
      when was_archived then 'archived ' || new.name
      when was_restored then 'restored ' || new.name
      else 'updated ' || new.name
    end;
  elsif tg_table_name = 'products_services' then
    entry_kind := 'catalog';
    entry_href := '/catalog';
    entry_summary := case
      when is_new then 'added “' || new.name || '” to the catalog'
      when was_archived then 'archived “' || new.name || '” in the catalog'
      when was_restored then 'restored “' || new.name || '” in the catalog'
      else 'updated “' || new.name || '” in the catalog'
    end;
  elsif tg_table_name = 'projects' then
    entry_kind := 'project';
    entry_href := '/work/projects/' || new.id;
    entry_project := new.id;
    if is_new then
      entry_summary := 'started project “' || new.name || '”';
    elsif new.status is distinct from old.status then
      entry_summary := 'marked project “' || new.name || '” as ' || replace(new.status::text, '_', ' ');
    else
      entry_summary := 'updated project “' || new.name || '”';
    end if;
  elsif tg_table_name = 'tasks' then
    -- Only clearing the legacy assignee column is not worth a line.
    if not is_new and new.assignee_id is null and old.assignee_id is not null
      and (to_jsonb(new) - 'assignee_id' - 'updated_at')
        = (to_jsonb(old) - 'assignee_id' - 'updated_at') then
      return new;
    end if;
    entry_kind := 'task';
    entry_project := new.project_id;
    entry_task := new.id;
    entry_href := '/work/tasks/' || new.id;
    if is_new then
      entry_summary := 'added task “' || new.title || '”';
    elsif new.status is distinct from old.status and new.status::text = 'done' then
      entry_summary := 'completed “' || new.title || '”';
    elsif new.status is distinct from old.status then
      entry_summary := 'moved “' || new.title || '” to '
        || case new.status::text
             when 'todo' then 'To do'
             when 'in_progress' then 'In progress'
             when 'in_review' then 'In review'
             else replace(new.status::text, '_', ' ')
           end;
    else
      entry_summary := 'updated task “' || new.title || '”';
    end if;
  else
    return new;
  end if;

  insert into public.activities (workspace_id, actor_id, kind, summary, href, project_id, task_id)
  values (new.workspace_id, (select auth.uid()), entry_kind, left(entry_summary, 300), entry_href,
    entry_project, entry_task);
  return new;
end;
$$;

-- Assigning and unassigning people, except while a task is being created.
create or replace function private.log_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.task_assignees := case when tg_op = 'DELETE' then old else new end;
  task_row public.tasks;
  person text;
begin
  select * into task_row from public.tasks where id = row_data.task_id;
  if task_row.id is null or task_row.created_at = now() then
    return null;
  end if;
  select coalesce(nullif(p.full_name, ''), 'someone') into person
  from public.profiles p where p.id = row_data.user_id;
  insert into public.activities (workspace_id, actor_id, kind, summary, href, project_id, task_id)
  values (task_row.workspace_id, (select auth.uid()), 'task',
    left(case when tg_op = 'INSERT'
      then 'assigned ' || coalesce(person, 'someone') || ' to “' || task_row.title || '”'
      else 'unassigned ' || coalesce(person, 'someone') || ' from “' || task_row.title || '”'
    end, 300),
    '/work/tasks/' || task_row.id, task_row.project_id, task_row.id);
  return null;
end;
$$;
drop trigger if exists task_assignees_activity on public.task_assignees;
create trigger task_assignees_activity after insert or delete on public.task_assignees
  for each row execute function private.log_assignment();

create or replace function private.log_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_row public.tasks;
begin
  select * into task_row from public.tasks where id = new.task_id;
  insert into public.activities (workspace_id, actor_id, kind, summary, href, project_id, task_id)
  values (new.workspace_id, (select auth.uid()), 'task',
    left('commented on “' || task_row.title || '”', 300),
    '/work/tasks/' || new.task_id || '#comment-' || new.id, task_row.project_id, new.task_id);
  return null;
end;
$$;
drop trigger if exists task_comments_activity on public.task_comments;
create trigger task_comments_activity after insert on public.task_comments
  for each row execute function private.log_comment();

-- ---------------------------------------------------------------------------
-- Saving a task and its assignees in one step
-- ---------------------------------------------------------------------------

-- Runs as the caller, so every rule above applies. Fields not present in
-- `fields` keep their current value on an update.
create or replace function public.save_task(
  target_workspace uuid,
  target_task uuid,
  fields jsonb,
  assignee_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if assignee_ids is not null and cardinality(assignee_ids) > 10 then
    raise exception 'too_many_assignees' using errcode = '23514';
  end if;

  if target_task is null then
    insert into public.tasks (workspace_id, project_id, title, description, status, priority, due_on)
    values (
      target_workspace,
      nullif(fields ->> 'projectId', '')::uuid,
      coalesce(fields ->> 'title', ''),
      coalesce(fields ->> 'description', ''),
      coalesce(nullif(fields ->> 'status', ''), 'todo')::public.task_status,
      coalesce(nullif(fields ->> 'priority', ''), 'medium')::public.task_priority,
      nullif(fields ->> 'dueOn', '')::date
    )
    returning id into saved_id;
  else
    update public.tasks t set
      title = case when fields ? 'title' then fields ->> 'title' else t.title end,
      description = case when fields ? 'description'
        then coalesce(fields ->> 'description', '') else t.description end,
      project_id = case when fields ? 'projectId'
        then nullif(fields ->> 'projectId', '')::uuid else t.project_id end,
      status = case when fields ? 'status'
        then (fields ->> 'status')::public.task_status else t.status end,
      priority = case when fields ? 'priority'
        then (fields ->> 'priority')::public.task_priority else t.priority end,
      due_on = case when fields ? 'dueOn'
        then nullif(fields ->> 'dueOn', '')::date else t.due_on end,
      assignee_id = case when assignee_ids is null then t.assignee_id else null end
    where t.id = target_task and t.workspace_id = target_workspace
    returning t.id into saved_id;
    if saved_id is null then
      raise exception 'task_not_editable' using errcode = '42501';
    end if;
  end if;

  if assignee_ids is not null then
    -- Add first, then remove, so someone reassigning a task they're on keeps
    -- the right to finish the change.
    insert into public.task_assignees (task_id, workspace_id, user_id)
    select saved_id, target_workspace, person
    from unnest(assignee_ids) as person
    on conflict do nothing;
    delete from public.task_assignees a
    where a.task_id = saved_id and a.user_id <> all (assignee_ids);
  end if;

  return saved_id;
end;
$$;
revoke execute on function public.save_task(uuid, uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.save_task(uuid, uuid, jsonb, uuid[]) to authenticated;
