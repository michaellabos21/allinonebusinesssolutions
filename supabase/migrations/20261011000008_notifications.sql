-- In-app notifications: the bell in the top bar.
--
-- Rows are written only by the triggers and the function below, never by the
-- app directly, so a notification always reflects something that happened.
-- Each person reads and marks read only their own, and only in workspaces
-- they are still an active member of.
--
-- What creates one, and the profile switch that turns it off:
--   task_assigned    someone assigns you a task             notify_task_assigned
--   task_mentioned   someone @mentions you in a comment     notify_mentions
--   task_comment     a comment on a task you're on/created  notify_task_comments
--   task_due         a task of yours is due today           notify_task_due
--   invoice_paid     a payment is recorded on an invoice    notify_payment_received
--   invoice_overdue  an issued invoice passes its due date  notify_invoice_overdue
--   lead_new         a lead comes in through a lead form    notify_new_leads
--
-- "Due today" and "overdue" depend on the date, not on a change, so they are
-- created when the person next opens the app (public.refresh_notifications),
-- at most once per task due date and per invoice due date.
--
-- Nobody is notified about their own action. Written so every statement can
-- run again safely.

-- ---------------------------------------------------------------------------
-- New switches, on by default like the existing ones
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists notify_task_assigned boolean not null default true,
  add column if not exists notify_task_comments boolean not null default true,
  add column if not exists notify_new_leads boolean not null default true;
grant update (notify_task_assigned, notify_task_comments, notify_new_leads)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Who it is for.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Who caused it; null for website visitors and date-based reminders.
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('task_assigned', 'task_mentioned', 'task_comment',
    'task_due', 'invoice_paid', 'invoice_overdue', 'lead_new')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 300),
  href text not null check (href ~ '^/' and char_length(href) <= 200),
  -- The record it is about, so it goes when the record does.
  task_id uuid references public.tasks (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  -- Stops a date-based reminder from being created twice.
  dedupe_key text check (char_length(dedupe_key) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, workspace_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id, workspace_id) where read_at is null;
create index if not exists notifications_task_idx on public.notifications (task_id) where task_id is not null;
create index if not exists notifications_invoice_idx on public.notifications (invoice_id) where invoice_id is not null;
create index if not exists notifications_lead_idx on public.notifications (lead_id) where lead_id is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_member(workspace_id));
drop policy if exists "Mark own notifications read" on public.notifications;
create policy "Mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_member(workspace_id))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether a person has a kind of notification switched on.
create or replace function private.wants_notification(target_user uuid, notification_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case notification_kind
      when 'task_assigned' then p.notify_task_assigned
      when 'task_mentioned' then p.notify_mentions
      when 'task_comment' then p.notify_task_comments
      when 'task_due' then p.notify_task_due
      when 'invoice_paid' then p.notify_payment_received
      when 'invoice_overdue' then p.notify_invoice_overdue
      when 'lead_new' then p.notify_new_leads
      else false
    end
    from public.profiles p where p.id = target_user
  ), false)
$$;

-- The name shown for whoever is acting now, or null when nobody is signed in.
create or replace function private.actor_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.full_name), '') from public.profiles p where p.id = (select auth.uid())
$$;

-- Today's date where the workspace is, which is what "due today" means in the
-- app. Falls back to UTC if the stored time zone is not one Postgres knows.
create or replace function private.workspace_today(target_workspace uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  zone text;
begin
  select w.timezone into zone from public.workspaces w where w.id = target_workspace;
  begin
    return (now() at time zone coalesce(zone, 'UTC'))::date;
  exception when others then
    return (now() at time zone 'UTC')::date;
  end;
end;
$$;

-- Creates one notification, unless it is for the person acting, they have
-- that kind switched off, or they are no longer an active member.
create or replace function private.notify(
  recipient uuid,
  target_workspace uuid,
  notification_kind text,
  notification_title text,
  notification_body text,
  link text,
  about_task uuid default null,
  about_invoice uuid default null,
  about_lead uuid default null,
  dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null
    or recipient is not distinct from (select auth.uid())
    or not private.wants_notification(recipient, notification_kind)
    or not exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = target_workspace and m.user_id = recipient and m.status = 'active'
    ) then
    return;
  end if;
  insert into public.notifications (workspace_id, user_id, actor_id, kind, title, body, href,
    task_id, invoice_id, lead_id, dedupe_key)
  values (target_workspace, recipient, (select auth.uid()), notification_kind,
    left(notification_title, 200), left(coalesce(notification_body, ''), 300), left(link, 200),
    about_task, about_invoice, about_lead, dedupe)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks: assigned, mentioned, commented on
-- ---------------------------------------------------------------------------

create or replace function private.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_row public.tasks;
begin
  select * into task_row from public.tasks where id = new.task_id;
  if task_row.id is null or task_row.status = 'done' then
    return null;
  end if;
  perform private.notify(new.user_id, new.workspace_id, 'task_assigned',
    coalesce(private.actor_name(), 'Someone') || ' assigned you a task',
    task_row.title, '/work/tasks/' || task_row.id, task_row.id);
  return null;
end;
$$;
drop trigger if exists task_assignees_notify on public.task_assignees;
create trigger task_assignees_notify after insert on public.task_assignees
  for each row execute function private.notify_task_assigned();

-- New mentions on a new or edited comment, and on a new comment, everyone
-- else on the task: its assignees and the person who created it.
create or replace function private.notify_task_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_row public.tasks;
  who text := coalesce(private.actor_name(), 'Someone');
  link text;
  preview text;
  person uuid;
  mentioned uuid[];
begin
  if new.deleted_at is not null then
    return null;
  end if;
  select * into task_row from public.tasks where id = new.task_id;
  if task_row.id is null then
    return null;
  end if;
  link := '/work/tasks/' || task_row.id || '#comment-' || new.id;
  preview := left(regexp_replace(btrim(new.body), '\s+', ' ', 'g'), 300);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(m), '{}') into mentioned
    from unnest(new.mentions) as m
    where not m = any (old.mentions);
  else
    mentioned := new.mentions;
  end if;

  foreach person in array mentioned loop
    perform private.notify(person, new.workspace_id, 'task_mentioned',
      left(who || ' mentioned you on “' || task_row.title || '”', 200), preview, link, task_row.id);
  end loop;

  if tg_op = 'INSERT' then
    for person in
      select a.user_id from public.task_assignees a where a.task_id = task_row.id
      union
      select task_row.created_by where task_row.created_by is not null
    loop
      if not person = any (new.mentions) and private.is_assignable(new.workspace_id, person) then
        perform private.notify(person, new.workspace_id, 'task_comment',
          left(who || ' commented on “' || task_row.title || '”', 200), preview, link, task_row.id);
      end if;
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists task_comments_notify on public.task_comments;
create trigger task_comments_notify after insert or update of mentions on public.task_comments
  for each row execute function private.notify_task_comment();

-- ---------------------------------------------------------------------------
-- Money: a payment is recorded. Told to everyone who manages finance.
-- ---------------------------------------------------------------------------

create or replace function private.notify_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  person uuid;
  paid_in_full boolean;
begin
  select * into inv from public.invoices where id = new.invoice_id;
  if inv.id is null then
    return null;
  end if;
  paid_in_full := inv.paid_minor + new.amount_minor >= inv.total_minor;
  for person in
    select m.user_id from public.workspace_memberships m
    where m.workspace_id = new.workspace_id and m.status = 'active'
      and m.role in ('owner', 'admin', 'manager')
  loop
    perform private.notify(person, new.workspace_id, 'invoice_paid',
      left(case when paid_in_full then coalesce(inv.number, 'An invoice') || ' is paid in full'
        else 'Payment recorded on ' || coalesce(inv.number, 'an invoice') end, 200),
      left(private.money_text(new.amount_minor, inv.currency)
        || coalesce(' from ' || nullif(inv.bill_to ->> 'name', ''), ''), 300),
      '/money/invoices/' || inv.id, null, inv.id);
  end loop;
  return null;
end;
$$;
drop trigger if exists payments_notify on public.payments;
create trigger payments_notify after insert on public.payments
  for each row execute function private.notify_payment();

-- ---------------------------------------------------------------------------
-- Sales: a lead arrives through a form. Told to everyone who works on leads.
-- ---------------------------------------------------------------------------

create or replace function private.notify_form_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  form_name text;
  person uuid;
begin
  select f.name into form_name from public.lead_forms f where f.id = new.form_id;
  for person in
    select m.user_id from public.workspace_memberships m
    where m.workspace_id = new.workspace_id and m.status = 'active' and m.role <> 'client'
  loop
    perform private.notify(person, new.workspace_id, 'lead_new',
      left('New lead from “' || coalesce(form_name, 'a lead form') || '”', 200),
      left(new.name || coalesce(' · ' || nullif(new.company_name, ''), ''), 300),
      '/crm/leads', null, null, new.id);
  end loop;
  return null;
end;
$$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads
  for each row when (new.form_id is not null)
  execute function private.notify_form_lead();

-- ---------------------------------------------------------------------------
-- Date-based reminders, created for the caller when they open the app
-- ---------------------------------------------------------------------------

create or replace function public.refresh_notifications(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  today date;
  item record;
begin
  if me is null or not private.is_member(target_workspace) then
    return;
  end if;
  today := private.workspace_today(target_workspace);

  if private.wants_notification(me, 'task_due') then
    for item in
      select t.id, t.title, t.due_on
      from public.tasks t
      join public.task_assignees a on a.task_id = t.id and a.user_id = me
      where t.workspace_id = target_workspace and t.status <> 'done' and t.due_on = today
    loop
      insert into public.notifications (workspace_id, user_id, kind, title, body, href, task_id, dedupe_key)
      values (target_workspace, me, 'task_due', 'Due today', left(item.title, 300),
        '/work/tasks/' || item.id, item.id, 'task_due:' || item.id || ':' || item.due_on)
      on conflict (user_id, dedupe_key) do nothing;
    end loop;
  end if;

  if private.can_manage_finance(target_workspace)
    and private.wants_notification(me, 'invoice_overdue') then
    for item in
      select i.id, i.number, i.due_on, i.currency, i.total_minor - i.paid_minor as owed,
        i.bill_to ->> 'name' as client
      from public.invoices i
      where i.workspace_id = target_workspace and i.status in ('sent', 'partially_paid')
        and i.due_on < today
    loop
      insert into public.notifications (workspace_id, user_id, kind, title, body, href, invoice_id, dedupe_key)
      values (target_workspace, me, 'invoice_overdue',
        left(coalesce(item.number, 'An invoice') || ' is overdue', 200),
        left(private.money_text(item.owed, item.currency) || ' owed'
          || coalesce(' by ' || nullif(item.client, ''), ''), 300),
        '/money/invoices/' || item.id, item.id,
        'invoice_overdue:' || item.id || ':' || item.due_on)
      on conflict (user_id, dedupe_key) do nothing;
    end loop;
  end if;

  -- Keep the list short: read notifications go after 90 days.
  delete from public.notifications n
  where n.user_id = me and n.read_at is not null and n.created_at < now() - interval '90 days';
end;
$$;
revoke execute on function public.refresh_notifications(uuid) from public, anon;
grant execute on function public.refresh_notifications(uuid) to authenticated;
