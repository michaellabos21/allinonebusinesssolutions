-- Backend Phase 2: companies, contacts, notes, catalog, projects, tasks, activity.
--
-- Access model for business records:
--   * Reading and ordinary editing: owner, admin, manager, member.
--   * Archiving and restoring, and managing projects and the catalog:
--     owner, admin, manager.
--   * Members may edit only the tasks they created or are assigned.
--   * The client role sees none of this until the client portal (Phase 5).
-- Row-level security enforces who may touch a row. Triggers enforce the rules
-- RLS cannot express: which columns may change, that linked records belong to
-- the same workspace, and that assignees are real members. Nothing is ever
-- hard-deleted, so there are no delete policies.

create type public.company_type as enum ('client', 'prospect');
create type public.contact_status as enum ('active', 'lead', 'inactive');
create type public.catalog_item_type as enum ('service', 'product');
create type public.project_status as enum ('active', 'on_hold', 'completed');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create function private.can_use_records(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_in(target_workspace) in ('owner', 'admin', 'manager', 'member'), false)
$$;

create function private.can_manage_records(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_in(target_workspace) in ('owner', 'admin', 'manager'), false)
$$;

-- Whether a user can be given work in a workspace: an active, non-client member.
create function private.is_assignable(target_workspace uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships m
    where m.workspace_id = target_workspace
      and m.user_id = target_user
      and m.status = 'active'
      and m.role <> 'client'
  )
$$;

grant execute on function private.can_use_records(uuid) to authenticated;
grant execute on function private.can_manage_records(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  type public.company_type not null default 'client',
  industry text not null default '' check (char_length(industry) <= 80),
  city text not null default '' check (char_length(city) <= 80),
  website text not null default '' check (char_length(website) <= 200),
  phone text not null default '' check (char_length(phone) <= 40),
  address text not null default '' check (char_length(address) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets other tables reference a company together with its workspace.
  unique (id, workspace_id)
);
create unique index companies_name_idx on public.companies (workspace_id, lower(name));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  title text not null default '' check (char_length(title) <= 120),
  source text not null default '' check (char_length(source) <= 80),
  status public.contact_status not null default 'active',
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  -- A contact's company must be in the same workspace.
  foreign key (company_id, workspace_id) references public.companies (id, workspace_id)
);
create unique index contacts_email_idx on public.contacts (workspace_id, email);
create index contacts_company_idx on public.contacts (company_id);

create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (contact_id, workspace_id) references public.contacts (id, workspace_id) on delete cascade
);
create index contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);

create table public.products_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  type public.catalog_item_type not null default 'service',
  -- Integer minor units of the workspace currency at the time of writing.
  unit_price_minor bigint not null check (unit_price_minor > 0 and unit_price_minor <= 100000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit text not null check (char_length(btrim(unit)) between 1 and 30),
  sku text not null default '' check (char_length(sku) <= 60),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_services_name_idx on public.products_services (workspace_id, lower(name));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  contact_id uuid,
  owner_id uuid not null references auth.users (id) on delete restrict,
  status public.project_status not null default 'active',
  start_on date not null default current_date,
  due_on date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (contact_id, workspace_id) references public.contacts (id, workspace_id)
);
create index projects_workspace_idx on public.projects (workspace_id, due_on);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_on date not null,
  assignee_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id)
);
create index tasks_workspace_idx on public.tasks (workspace_id, due_on);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id) where status <> 'done';

-- Chronological feed of changes. Rows are written only by the triggers below,
-- so an entry always reflects something that really happened and who did it.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('contact', 'company', 'catalog', 'project', 'task')),
  -- Reads after the actor's name, e.g. 'added Ana Cruz as a contact'.
  summary text not null check (char_length(summary) between 1 and 300),
  href text not null check (href ~ '^/' and char_length(href) <= 200),
  project_id uuid references public.projects (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index activities_workspace_idx on public.activities (workspace_id, created_at desc);
create index activities_project_idx on public.activities (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Guards that row-level security cannot express
-- ---------------------------------------------------------------------------

-- On insert, the creator is always the caller. On update, a row can never be
-- moved to another workspace or have its origin rewritten.
create function private.guard_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Fixtures written with the service role have no caller and keep what they pass.
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    if new.workspace_id is distinct from old.workspace_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'immutable_column' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Archiving and restoring is for managers and above.
create function private.guard_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at
    and (select auth.uid()) is not null
    and not private.can_manage_records(new.workspace_id) then
    raise exception 'forbidden_archive' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_project_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_assignable(new.workspace_id, new.owner_id) then
    raise exception 'owner_not_a_member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.guard_task_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_assignable(new.workspace_id, new.assignee_id) then
    raise exception 'assignee_not_a_member' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A note's author is always the caller.
create function private.guard_note_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.author_id := (select auth.uid());
  end if;
  return new;
end;
$$;

-- These helpers are called from triggers, which run as the table owner's
-- functions; nobody needs to call them directly.
grant execute on function private.is_assignable(uuid, uuid) to authenticated;

create trigger companies_identity before insert or update on public.companies
  for each row execute function private.guard_identity();
create trigger companies_archive before update on public.companies
  for each row execute function private.guard_archive();
create trigger companies_touch before update on public.companies
  for each row execute function private.touch_updated_at();

create trigger contacts_identity before insert or update on public.contacts
  for each row execute function private.guard_identity();
create trigger contacts_archive before update on public.contacts
  for each row execute function private.guard_archive();
create trigger contacts_touch before update on public.contacts
  for each row execute function private.touch_updated_at();

create trigger contact_notes_author before insert on public.contact_notes
  for each row execute function private.guard_note_author();

create trigger products_services_identity before insert or update on public.products_services
  for each row execute function private.guard_identity();
create trigger products_services_touch before update on public.products_services
  for each row execute function private.touch_updated_at();

create trigger projects_identity before insert or update on public.projects
  for each row execute function private.guard_identity();
create trigger projects_owner before insert or update of owner_id on public.projects
  for each row execute function private.guard_project_owner();
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

create trigger tasks_identity before insert or update on public.tasks
  for each row execute function private.guard_identity();
create trigger tasks_assignee before insert or update of assignee_id on public.tasks
  for each row execute function private.guard_task_assignee();
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------

create function private.log_activity()
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
    entry_kind := 'task';
    entry_project := new.project_id;
    entry_href := coalesce('/work/projects/' || new.project_id, '/work/tasks');
    if is_new then
      entry_summary := 'added task “' || new.title || '”';
    elsif new.status is distinct from old.status and new.status = 'done' then
      entry_summary := 'completed “' || new.title || '”';
    elsif new.status is distinct from old.status then
      entry_summary := 'moved “' || new.title || '” to '
        || case new.status when 'todo' then 'To do' else 'In progress' end;
    else
      entry_summary := 'updated task “' || new.title || '”';
    end if;
  else
    return new;
  end if;

  insert into public.activities (workspace_id, actor_id, kind, summary, href, project_id)
  values (new.workspace_id, (select auth.uid()), entry_kind, left(entry_summary, 300), entry_href, entry_project);
  return new;
end;
$$;

create trigger contacts_activity after insert or update on public.contacts
  for each row execute function private.log_activity();
create trigger companies_activity after insert or update on public.companies
  for each row execute function private.log_activity();
create trigger products_services_activity after insert or update on public.products_services
  for each row execute function private.log_activity();
create trigger projects_activity after insert or update on public.projects
  for each row execute function private.log_activity();
create trigger tasks_activity after insert or update on public.tasks
  for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.products_services enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

revoke all on public.companies, public.contacts, public.contact_notes, public.products_services,
  public.projects, public.tasks, public.activities from anon;
-- No deletes anywhere, and the activity feed is written only by triggers.
revoke delete, truncate on public.companies, public.contacts, public.contact_notes,
  public.products_services, public.projects, public.tasks from authenticated;
revoke insert, update, delete, truncate on public.activities from authenticated;
revoke update on public.contact_notes from authenticated;

create policy "Team reads companies" on public.companies
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds companies" on public.companies
  for insert to authenticated with check (private.can_use_records(workspace_id));
create policy "Team edits companies" on public.companies
  for update to authenticated
  using (private.can_use_records(workspace_id))
  with check (private.can_use_records(workspace_id));

create policy "Team reads contacts" on public.contacts
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds contacts" on public.contacts
  for insert to authenticated with check (private.can_use_records(workspace_id));
create policy "Team edits contacts" on public.contacts
  for update to authenticated
  using (private.can_use_records(workspace_id))
  with check (private.can_use_records(workspace_id));

create policy "Team reads notes" on public.contact_notes
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds notes" on public.contact_notes
  for insert to authenticated with check (private.can_use_records(workspace_id));

create policy "Team reads the catalog" on public.products_services
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Managers add catalog items" on public.products_services
  for insert to authenticated with check (private.can_manage_records(workspace_id));
create policy "Managers edit catalog items" on public.products_services
  for update to authenticated
  using (private.can_manage_records(workspace_id))
  with check (private.can_manage_records(workspace_id));

create policy "Team reads projects" on public.projects
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Managers add projects" on public.projects
  for insert to authenticated with check (private.can_manage_records(workspace_id));
create policy "Managers edit projects" on public.projects
  for update to authenticated
  using (private.can_manage_records(workspace_id))
  with check (private.can_manage_records(workspace_id));

create policy "Team reads tasks" on public.tasks
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds tasks" on public.tasks
  for insert to authenticated with check (private.can_use_records(workspace_id));
-- Managers edit any task; a member only those they created or are assigned.
create policy "Edit own or managed tasks" on public.tasks
  for update to authenticated
  using (
    private.can_manage_records(workspace_id)
    or (
      private.can_use_records(workspace_id)
      and ((select auth.uid()) = created_by or (select auth.uid()) = assignee_id)
    )
  )
  with check (private.can_use_records(workspace_id));

create policy "Team reads the activity feed" on public.activities
  for select to authenticated using (private.can_use_records(workspace_id));

-- ---------------------------------------------------------------------------
-- Bulk contact import
-- ---------------------------------------------------------------------------

-- Writes the single feed line for an import. Definer, because the feed is not
-- writable by users; it re-checks the caller and only ever says how many.
create function private.record_import(target_workspace uuid, imported integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if imported < 1 or not private.can_use_records(target_workspace) then
    return;
  end if;
  insert into public.activities (workspace_id, actor_id, kind, summary, href)
  values (
    target_workspace,
    (select auth.uid()),
    'contact',
    'imported ' || imported || case when imported = 1 then ' contact' else ' contacts' end || ' from a CSV file',
    '/crm/contacts'
  );
end;
$$;
grant execute on function private.record_import(uuid, integer) to authenticated;

-- Imports validated rows in one transaction. Runs as the caller, so every row
-- still passes row-level security and the table constraints. Rows whose email
-- already exists are skipped and reported, never overwritten. Companies are
-- matched by name and created when new. The feed gets a single summary line.
create function public.import_contacts(target_workspace uuid, rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  position integer := 0;
  imported integer := 0;
  skipped jsonb := '[]'::jsonb;
  row_email text;
  row_company text;
  row_company_id uuid;
  row_status public.contact_status;
begin
  if not private.can_use_records(target_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  perform set_config('app.bulk_import', 'on', true);

  for item in select * from jsonb_array_elements(rows) loop
    position := position + 1;
    row_email := lower(btrim(coalesce(item ->> 'email', '')));

    if exists (
      select 1 from public.contacts c where c.workspace_id = target_workspace and c.email = row_email
    ) then
      skipped := skipped || jsonb_build_object('row', position, 'reason', 'email_exists');
      continue;
    end if;

    row_company := btrim(coalesce(item ->> 'company', ''));
    row_company_id := null;
    if row_company <> '' then
      select c.id into row_company_id
      from public.companies c
      where c.workspace_id = target_workspace and lower(c.name) = lower(row_company);
      if row_company_id is null then
        insert into public.companies (workspace_id, name) values (target_workspace, row_company)
        returning id into row_company_id;
      end if;
    end if;

    row_status := coalesce(nullif(item ->> 'status', ''), 'active')::public.contact_status;

    insert into public.contacts (workspace_id, company_id, name, email, phone, title, source, status, tags)
    values (
      target_workspace,
      row_company_id,
      btrim(item ->> 'name'),
      row_email,
      btrim(coalesce(item ->> 'phone', '')),
      btrim(coalesce(item ->> 'title', '')),
      'CSV import',
      row_status,
      coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(item -> 'tags', '[]'::jsonb))), '{}')
    );
    imported := imported + 1;
  end loop;

  perform set_config('app.bulk_import', 'off', true);

  perform private.record_import(target_workspace, imported);

  return jsonb_build_object('imported', imported, 'skipped', skipped);
end;
$$;

revoke execute on function public.import_contacts(uuid, jsonb) from public, anon;
grant execute on function public.import_contacts(uuid, jsonb) to authenticated;
