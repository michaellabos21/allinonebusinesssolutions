-- Backend Phase 3: pipeline stages, leads, deals, lead conversion and public
-- lead capture forms.
--
-- Access model, following the Phase 2 rules:
--   * Leads and deals: owner, admin, manager and member read, add and edit.
--     Archiving and restoring is for managers and above.
--   * Pipeline stages and lead forms: everyone on the team reads them;
--     managers and above change them.
--   * Clients see none of this.
--   * The public reaches exactly two functions, get_lead_form and
--     submit_lead_form. Both take a form's secret token, never a workspace id,
--     and neither returns anything about existing records.
--
-- Each workspace has one pipeline, so stages belong to the workspace directly.
-- A separate pipelines table can be added if several pipelines are ever needed.

create type public.stage_kind as enum ('open', 'won', 'lost');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'disqualified', 'converted');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position integer not null check (position between 0 and 1000),
  kind public.stage_kind not null default 'open',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index pipeline_stages_name_idx
  on public.pipeline_stages (workspace_id, lower(name)) where archived_at is null;
create index pipeline_stages_workspace_idx on public.pipeline_stages (workspace_id, position);

create table public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- The only thing a visitor ever sends to identify the form. Unguessable.
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  intro text not null default '' check (char_length(intro) <= 500),
  -- Shown beside a required checkbox when not empty. Written by the business.
  consent_text text not null default '' check (char_length(consent_text) <= 1000),
  success_message text not null default 'Thanks, we’ll be in touch soon.'
    check (char_length(btrim(success_message)) between 1 and 300),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index lead_forms_workspace_idx on public.lead_forms (workspace_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Optional, but a valid lower-case address when present.
  email text not null default ''
    check (email = '' or (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254)),
  phone text not null default '' check (char_length(phone) <= 40),
  company_name text not null default '' check (char_length(company_name) <= 120),
  source text not null default '' check (char_length(source) <= 80),
  status public.lead_status not null default 'new',
  notes text not null default '' check (char_length(notes) <= 4000),
  owner_id uuid references auth.users (id) on delete set null,
  form_id uuid,
  converted_contact_id uuid,
  converted_deal_id uuid,
  converted_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (form_id, workspace_id) references public.lead_forms (id, workspace_id),
  foreign key (converted_contact_id, workspace_id) references public.contacts (id, workspace_id),
  -- Converted exactly when a contact is recorded.
  check ((status = 'converted') = (converted_contact_id is not null and converted_at is not null))
);
create index leads_workspace_idx on public.leads (workspace_id, created_at desc);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  company_id uuid,
  contact_id uuid,
  owner_id uuid not null references auth.users (id) on delete restrict,
  stage_id uuid not null,
  -- Integer minor units with an ISO currency code. Never floating point.
  amount_minor bigint not null default 0 check (amount_minor between 0 and 100000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  expected_close_on date not null,
  -- Set by the database when the deal enters a won or lost stage.
  closed_on date,
  lost_reason text not null default '' check (char_length(lost_reason) <= 300),
  lead_id uuid,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (company_id, workspace_id) references public.companies (id, workspace_id),
  foreign key (contact_id, workspace_id) references public.contacts (id, workspace_id),
  foreign key (stage_id, workspace_id) references public.pipeline_stages (id, workspace_id),
  foreign key (lead_id, workspace_id) references public.leads (id, workspace_id)
);
create index deals_workspace_idx on public.deals (workspace_id, expected_close_on);
create index deals_stage_idx on public.deals (stage_id) where archived_at is null;

alter table public.leads
  add foreign key (converted_deal_id, workspace_id) references public.deals (id, workspace_id);

-- One row per accepted public submission. Used for rate limiting and as a
-- record of where a lead came from; never shown to the public.
create table public.lead_form_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  form_id uuid not null,
  lead_id uuid not null,
  -- A hash of the visitor's network address, computed by the app server.
  client_hash text not null check (char_length(client_hash) between 1 and 128),
  created_at timestamptz not null default now(),
  foreign key (form_id, workspace_id) references public.lead_forms (id, workspace_id),
  foreign key (lead_id, workspace_id) references public.leads (id, workspace_id)
);
create index lead_form_submissions_rate_idx
  on public.lead_form_submissions (form_id, client_hash, created_at desc);
create index lead_form_submissions_form_idx
  on public.lead_form_submissions (form_id, created_at desc);

-- The activity feed learns about leads and deals. Deal entries carry the deal,
-- which gives each deal its own history.
alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('contact', 'company', 'catalog', 'project', 'task', 'lead', 'deal'));
alter table public.activities add column deal_id uuid references public.deals (id) on delete cascade;
create index activities_deal_idx on public.activities (deal_id, created_at desc) where deal_id is not null;

-- ---------------------------------------------------------------------------
-- Default stages for every workspace, now and when one is created
-- ---------------------------------------------------------------------------

create function private.seed_pipeline(target_workspace uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.pipeline_stages (workspace_id, name, position, kind)
  values
    (target_workspace, 'Discovery', 0, 'open'),
    (target_workspace, 'Qualified', 1, 'open'),
    (target_workspace, 'Proposal', 2, 'open'),
    (target_workspace, 'Negotiation', 3, 'open'),
    (target_workspace, 'Won', 4, 'won'),
    (target_workspace, 'Lost', 5, 'lost')
$$;

create function private.seed_pipeline_for_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_pipeline(new.id);
  return new;
end;
$$;

create trigger workspaces_seed_pipeline after insert on public.workspaces
  for each row execute function private.seed_pipeline_for_new_workspace();

select private.seed_pipeline(w.id) from public.workspaces w;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- A workspace always keeps at least one open stage, one won stage and one
-- lost stage, and a stage holding live deals cannot be archived. Checked at
-- the end of the transaction, so stages can be rearranged in several steps.
create function private.guard_pipeline_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := new.workspace_id;
begin
  if tg_op = 'UPDATE' and new.archived_at is not null and old.archived_at is null
    and exists (
      select 1 from public.deals d where d.stage_id = new.id and d.archived_at is null
    ) then
    raise exception 'stage_has_deals' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind
    and exists (select 1 from public.deals d where d.stage_id = new.id) then
    raise exception 'stage_kind_in_use' using errcode = '23514';
  end if;
  if not exists (select 1 from public.pipeline_stages s where s.workspace_id = ws and s.archived_at is null and s.kind = 'open')
    or not exists (select 1 from public.pipeline_stages s where s.workspace_id = ws and s.archived_at is null and s.kind = 'won')
    or not exists (select 1 from public.pipeline_stages s where s.workspace_id = ws and s.archived_at is null and s.kind = 'lost') then
    raise exception 'pipeline_needs_open_won_lost' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger pipeline_stages_shape
  after insert or update on public.pipeline_stages
  deferrable initially deferred
  for each row execute function private.guard_pipeline_shape();

create function private.guard_stage_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'immutable_column' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Deals: the owner is a real member, the stage is live, the currency comes
-- from the workspace when not given, and closing fields follow the stage.
create function private.guard_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stage_kind public.stage_kind;
  stage_archived timestamptz;
begin
  if not private.is_assignable(new.workspace_id, new.owner_id) then
    raise exception 'owner_not_a_member' using errcode = '23514';
  end if;

  select s.kind, s.archived_at into stage_kind, stage_archived
  from public.pipeline_stages s
  where s.id = new.stage_id and s.workspace_id = new.workspace_id;

  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    if stage_archived is not null then
      raise exception 'stage_archived' using errcode = '23514';
    end if;
  end if;

  if stage_kind = 'open' then
    new.closed_on := null;
    new.lost_reason := '';
  elsif tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.closed_on := current_date;
  end if;
  if stage_kind = 'won' then
    new.lost_reason := '';
  end if;
  if stage_kind = 'lost' and btrim(new.lost_reason) = '' then
    raise exception 'lost_reason_required' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.lead_id is distinct from old.lead_id then
    raise exception 'immutable_column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_deal_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null then
    select w.currency into new.currency from public.workspaces w where w.id = new.workspace_id;
  end if;
  return new;
end;
$$;

-- Leads: the owner, when set, is a real member. A lead becomes converted only
-- through convert_lead, and a converted lead's outcome never changes.
create function private.guard_lead()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null
    and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id)
    and not private.is_assignable(new.workspace_id, new.owner_id) then
    raise exception 'owner_not_a_member' using errcode = '23514';
  end if;

  if current_setting('app.converting_lead', true) is distinct from new.id::text then
    if tg_op = 'INSERT' and new.status = 'converted' then
      raise exception 'convert_with_function' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.status is distinct from old.status and (new.status = 'converted' or old.status = 'converted')
      or new.converted_contact_id is distinct from old.converted_contact_id
      or new.converted_deal_id is distinct from old.converted_deal_id
      or new.converted_at is distinct from old.converted_at
    ) then
      raise exception 'convert_with_function' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.form_id is distinct from old.form_id then
    raise exception 'immutable_column' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_form_token()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.token is distinct from old.token then
    raise exception 'immutable_column' using errcode = '42501';
  end if;
  return new;
end;
$$;

grant execute on function private.is_assignable(uuid, uuid) to authenticated;

create trigger pipeline_stages_workspace before update on public.pipeline_stages
  for each row execute function private.guard_stage_workspace();
create trigger pipeline_stages_touch before update on public.pipeline_stages
  for each row execute function private.touch_updated_at();

create trigger lead_forms_identity before insert or update on public.lead_forms
  for each row execute function private.guard_identity();
create trigger lead_forms_token before update on public.lead_forms
  for each row execute function private.guard_form_token();
create trigger lead_forms_touch before update on public.lead_forms
  for each row execute function private.touch_updated_at();

create trigger leads_identity before insert or update on public.leads
  for each row execute function private.guard_identity();
create trigger leads_archive before update on public.leads
  for each row execute function private.guard_archive();
create trigger leads_rules before insert or update on public.leads
  for each row execute function private.guard_lead();
create trigger leads_touch before update on public.leads
  for each row execute function private.touch_updated_at();

create trigger deals_identity before insert or update on public.deals
  for each row execute function private.guard_identity();
create trigger deals_archive before update on public.deals
  for each row execute function private.guard_archive();
create trigger deals_currency before insert on public.deals
  for each row execute function private.guard_deal_currency();
create trigger deals_rules before insert or update on public.deals
  for each row execute function private.guard_deal();
create trigger deals_touch before update on public.deals
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Activity: leads, and a history line for each important deal change
-- ---------------------------------------------------------------------------

create function private.money_text(amount bigint, currency text)
returns text
language sql
immutable
set search_path = ''
as $$
  select currency || ' ' || to_char(amount / 100.0, 'FM999,999,999,990.00')
$$;

create function private.log_sales_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  stage_name text;
  stage_kind public.stage_kind;
  owner_name text;
begin
  if tg_table_name = 'leads' then
    -- Form submissions and conversions write their own line.
    if current_setting('app.lead_form', true) = 'on'
      or current_setting('app.converting_lead', true) = new.id::text then
      return new;
    end if;
    if tg_op = 'INSERT' then
      insert into public.activities (workspace_id, actor_id, kind, summary, href)
      values (new.workspace_id, actor, 'lead', left('added ' || new.name || ' as a lead', 300), '/crm/leads');
    elsif new.archived_at is not null and old.archived_at is null then
      insert into public.activities (workspace_id, actor_id, kind, summary, href)
      values (new.workspace_id, actor, 'lead', left('archived the lead ' || new.name, 300), '/crm/leads');
    elsif new.status is distinct from old.status then
      insert into public.activities (workspace_id, actor_id, kind, summary, href)
      values (new.workspace_id, actor, 'lead',
        left('marked the lead ' || new.name || ' as ' || new.status::text, 300), '/crm/leads');
    end if;
    return new;
  end if;

  -- Deals
  select s.name, s.kind into stage_name, stage_kind
  from public.pipeline_stages s where s.id = new.stage_id;

  if tg_op = 'INSERT' then
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal',
      left('opened the deal “' || new.name || '” at ' || stage_name || ', '
        || private.money_text(new.amount_minor, new.currency), 300),
      '/crm/deals?deal=' || new.id, new.id);
    return new;
  end if;

  if new.stage_id is distinct from old.stage_id then
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal',
      left(case stage_kind
        when 'won' then 'won the deal “' || new.name || '”'
        when 'lost' then 'lost the deal “' || new.name || '”: ' || new.lost_reason
        else 'moved “' || new.name || '” to ' || stage_name
      end, 300),
      '/crm/deals?deal=' || new.id, new.id);
  end if;
  if new.amount_minor is distinct from old.amount_minor or new.currency is distinct from old.currency then
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal',
      left('changed the value of “' || new.name || '” from '
        || private.money_text(old.amount_minor, old.currency) || ' to '
        || private.money_text(new.amount_minor, new.currency), 300),
      '/crm/deals?deal=' || new.id, new.id);
  end if;
  if new.owner_id is distinct from old.owner_id then
    select p.full_name into owner_name from public.profiles p where p.id = new.owner_id;
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal',
      left('handed “' || new.name || '” to ' || coalesce(nullif(owner_name, ''), 'a teammate'), 300),
      '/crm/deals?deal=' || new.id, new.id);
  end if;
  if new.archived_at is not null and old.archived_at is null then
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal', left('archived the deal “' || new.name || '”', 300),
      '/crm/deals?deal=' || new.id, new.id);
  elsif new.archived_at is null and old.archived_at is not null then
    insert into public.activities (workspace_id, actor_id, kind, summary, href, deal_id)
    values (new.workspace_id, actor, 'deal', left('restored the deal “' || new.name || '”', 300),
      '/crm/deals?deal=' || new.id, new.id);
  end if;
  return new;
end;
$$;

create trigger leads_activity after insert or update on public.leads
  for each row execute function private.log_sales_activity();
create trigger deals_activity after insert or update on public.deals
  for each row execute function private.log_sales_activity();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.pipeline_stages enable row level security;
alter table public.lead_forms enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.lead_form_submissions enable row level security;

revoke all on public.pipeline_stages, public.lead_forms, public.leads, public.deals,
  public.lead_form_submissions from anon;
revoke delete, truncate on public.pipeline_stages, public.lead_forms, public.leads, public.deals
  from authenticated;
revoke insert, update, delete, truncate on public.lead_form_submissions from authenticated;

create policy "Team reads stages" on public.pipeline_stages
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Managers add stages" on public.pipeline_stages
  for insert to authenticated with check (private.can_manage_records(workspace_id));
create policy "Managers edit stages" on public.pipeline_stages
  for update to authenticated
  using (private.can_manage_records(workspace_id))
  with check (private.can_manage_records(workspace_id));

create policy "Team reads lead forms" on public.lead_forms
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Managers add lead forms" on public.lead_forms
  for insert to authenticated with check (private.can_manage_records(workspace_id));
create policy "Managers edit lead forms" on public.lead_forms
  for update to authenticated
  using (private.can_manage_records(workspace_id))
  with check (private.can_manage_records(workspace_id));

create policy "Team reads leads" on public.leads
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds leads" on public.leads
  for insert to authenticated with check (private.can_use_records(workspace_id));
create policy "Team edits leads" on public.leads
  for update to authenticated
  using (private.can_use_records(workspace_id))
  with check (private.can_use_records(workspace_id));

create policy "Team reads deals" on public.deals
  for select to authenticated using (private.can_use_records(workspace_id));
create policy "Team adds deals" on public.deals
  for insert to authenticated with check (private.can_use_records(workspace_id));
create policy "Team edits deals" on public.deals
  for update to authenticated
  using (private.can_use_records(workspace_id))
  with check (private.can_use_records(workspace_id));

create policy "Team reads form submissions" on public.lead_form_submissions
  for select to authenticated using (private.can_use_records(workspace_id));

-- ---------------------------------------------------------------------------
-- Stage order
-- ---------------------------------------------------------------------------

-- Sets the order of a workspace's live stages in one step. Runs as the caller,
-- so row-level security decides who may do it.
create function public.set_stage_order(target_workspace uuid, stage_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  live_count integer;
begin
  if not private.can_manage_records(target_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into live_count
  from public.pipeline_stages s
  where s.workspace_id = target_workspace and s.archived_at is null;
  if cardinality(stage_ids) <> live_count
    or (select count(distinct wanted.stage) from unnest(stage_ids) as wanted (stage)) <> live_count
    or exists (
      select 1 from unnest(stage_ids) as wanted (stage)
      where not exists (
        select 1 from public.pipeline_stages s
        where s.id = wanted.stage and s.workspace_id = target_workspace and s.archived_at is null
      )
    ) then
    raise exception 'invalid_stage_list' using errcode = '22023';
  end if;

  update public.pipeline_stages s
  set position = ordered.ordinality - 1
  from unnest(stage_ids) with ordinality as ordered (id, ordinality)
  where s.id = ordered.id;
end;
$$;

revoke execute on function public.set_stage_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_stage_order(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Lead conversion
-- ---------------------------------------------------------------------------

create function private.record_conversion(target_lead uuid, contact_name text, deal_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select l.workspace_id into ws from public.leads l where l.id = target_lead;
  if ws is null or not private.can_use_records(ws) then
    return;
  end if;
  insert into public.activities (workspace_id, actor_id, kind, summary, href)
  values (ws, (select auth.uid()), 'lead',
    left('converted a lead into the contact ' || contact_name
      || coalesce(' and the deal “' || deal_name || '”', ''), 300),
    '/crm/leads');
end;
$$;
grant execute on function private.record_conversion(uuid, text, text) to authenticated;

-- Turns a lead into a contact (and its company), and optionally a deal, in one
-- transaction. Runs as the caller, so every write passes row-level security.
-- Duplicates are avoided: a chosen contact is used as is; otherwise a contact
-- with the lead's email is reused; companies are matched by name.
create function public.convert_lead(
  target_lead uuid,
  existing_contact uuid,
  create_deal boolean,
  deal_name text,
  deal_amount_minor bigint,
  deal_stage uuid,
  deal_close_on date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lead public.leads;
  contact_row public.contacts;
  company uuid;
  new_deal uuid;
  reused boolean := false;
  stage uuid := deal_stage;
begin
  select * into lead from public.leads l where l.id = target_lead for update;
  if lead.id is null or not private.can_use_records(lead.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if lead.status = 'converted' then
    raise exception 'already_converted' using errcode = '23514';
  end if;
  if lead.archived_at is not null then
    raise exception 'lead_archived' using errcode = '23514';
  end if;

  if existing_contact is not null then
    select * into contact_row from public.contacts c
    where c.id = existing_contact and c.workspace_id = lead.workspace_id;
    if contact_row.id is null then
      raise exception 'contact_not_found' using errcode = 'P0002';
    end if;
    reused := true;
  elsif lead.email <> '' then
    select * into contact_row from public.contacts c
    where c.workspace_id = lead.workspace_id and c.email = lead.email;
    reused := contact_row.id is not null;
  end if;

  if contact_row.id is null then
    if lead.email = '' then
      raise exception 'email_required' using errcode = '23514';
    end if;
    if btrim(lead.company_name) <> '' then
      select c.id into company from public.companies c
      where c.workspace_id = lead.workspace_id and lower(c.name) = lower(btrim(lead.company_name));
      if company is null then
        insert into public.companies (workspace_id, name, type)
        values (lead.workspace_id, btrim(lead.company_name), 'prospect')
        returning id into company;
      end if;
    end if;
    insert into public.contacts (workspace_id, company_id, name, email, phone, source, status)
    values (lead.workspace_id, company, lead.name, lead.email, lead.phone,
      coalesce(nullif(lead.source, ''), 'Lead'), 'active')
    returning * into contact_row;
  end if;

  if create_deal then
    if stage is null then
      select s.id into stage from public.pipeline_stages s
      where s.workspace_id = lead.workspace_id and s.archived_at is null and s.kind = 'open'
      order by s.position limit 1;
    end if;
    insert into public.deals (
      workspace_id, name, company_id, contact_id, owner_id, stage_id,
      amount_minor, expected_close_on, lead_id
    )
    values (
      lead.workspace_id,
      coalesce(nullif(btrim(deal_name), ''), lead.name),
      contact_row.company_id,
      contact_row.id,
      coalesce(lead.owner_id, (select auth.uid())),
      stage,
      coalesce(deal_amount_minor, 0),
      coalesce(deal_close_on, current_date + 30),
      lead.id
    )
    returning id into new_deal;
  end if;

  perform set_config('app.converting_lead', lead.id::text, true);
  update public.leads
  set status = 'converted',
      converted_contact_id = contact_row.id,
      converted_deal_id = new_deal,
      converted_at = now()
  where id = lead.id;
  perform set_config('app.converting_lead', '', true);

  perform private.record_conversion(
    lead.id, contact_row.name,
    case when new_deal is null then null else coalesce(nullif(btrim(deal_name), ''), lead.name) end
  );

  return jsonb_build_object('contactId', contact_row.id, 'dealId', new_deal, 'reusedContact', reused);
end;
$$;

revoke execute on function public.convert_lead(uuid, uuid, boolean, text, bigint, uuid, date) from public, anon;
grant execute on function public.convert_lead(uuid, uuid, boolean, text, bigint, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Public lead capture
-- ---------------------------------------------------------------------------

-- What a visitor needs to draw the form. Nothing else about the workspace.
create function public.get_lead_form(form_token text)
returns table (form_name text, business_name text, intro text, consent_text text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, w.name, f.intro, f.consent_text
  from public.lead_forms f
  join public.workspaces w on w.id = f.workspace_id
  where f.token = form_token and f.active
$$;

-- Accepts one submission. The workspace comes from the form's token, never
-- from the visitor. Limits: 3 per visitor per form in 10 minutes, and 100 per
-- form per hour, so a flood cannot fill a workspace with junk. Returns only the
-- thank-you message.
create function public.submit_lead_form(form_token text, payload jsonb, client_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  form public.lead_forms;
  lead_name text := btrim(coalesce(payload ->> 'name', ''));
  lead_email text := lower(btrim(coalesce(payload ->> 'email', '')));
  lead_phone text := btrim(coalesce(payload ->> 'phone', ''));
  lead_company text := btrim(coalesce(payload ->> 'company', ''));
  lead_message text := btrim(coalesce(payload ->> 'message', ''));
  new_lead uuid;
begin
  select * into form from public.lead_forms f where f.token = form_token and f.active;
  if form.id is null then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  if client_key is null or char_length(client_key) not between 1 and 128 then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;

  if (
    select count(*) from public.lead_form_submissions s
    where s.form_id = form.id and s.client_hash = client_key
      and s.created_at > now() - interval '10 minutes'
  ) >= 3 or (
    select count(*) from public.lead_form_submissions s
    where s.form_id = form.id and s.created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if char_length(lead_name) not between 1 and 120
    or lead_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(lead_email) > 254
    or char_length(lead_phone) > 40
    or char_length(lead_company) > 120
    or char_length(lead_message) > 2000
    or (form.consent_text <> '' and coalesce(payload ->> 'consent', '') <> 'true') then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;

  perform set_config('app.lead_form', 'on', true);
  insert into public.leads (workspace_id, name, email, phone, company_name, source, notes, form_id)
  values (form.workspace_id, lead_name, lead_email, lead_phone, lead_company,
    left('Form: ' || form.name, 80), lead_message, form.id)
  returning id into new_lead;
  perform set_config('app.lead_form', 'off', true);

  insert into public.lead_form_submissions (workspace_id, form_id, lead_id, client_hash)
  values (form.workspace_id, form.id, new_lead, client_key);

  insert into public.activities (workspace_id, actor_id, kind, summary, href)
  values (form.workspace_id, null, 'lead',
    left('New enquiry from ' || lead_name || ' through the form “' || form.name || '”', 300),
    '/crm/leads');

  return form.success_message;
end;
$$;

revoke execute on function public.get_lead_form(text) from public;
revoke execute on function public.submit_lead_form(text, jsonb, text) from public;
grant execute on function public.get_lead_form(text) to anon, authenticated;
grant execute on function public.submit_lead_form(text, jsonb, text) to anon, authenticated;
