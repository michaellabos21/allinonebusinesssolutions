-- Backend Phase 1: accounts, workspaces, membership, invitations, audit log.
--
-- Access model, enforced here as well as in server code:
--   * Row-level security lets a signed-in user READ only rows of workspaces
--     they are an active member of.
--   * Almost every WRITE goes through a security-definer function below that
--     re-checks who the caller is and what their role allows. There are no
--     insert/update/delete policies on memberships, invitations or audit logs,
--     so those tables cannot be written directly at all.
--   * Nothing here trusts a workspace id, user id or role sent by a client:
--     the caller is always auth.uid(), and their role is looked up.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.workspace_role as enum ('owner', 'admin', 'manager', 'member', 'client');
create type public.membership_status as enum ('active', 'removed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copy of the sign-in address, kept in step by a trigger, so teammates can
  -- be listed without exposing the auth schema.
  email text not null check (email = lower(email) and char_length(email) <= 254),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  job_title text not null default '' check (char_length(job_title) <= 120),
  timezone text not null default 'Asia/Manila' check (char_length(timezone) between 1 and 64),
  date_format text not null default 'dmy' check (date_format in ('dmy', 'mdy')),
  week_starts_on smallint not null default 0 check (week_starts_on in (0, 1)),
  notify_invoice_overdue boolean not null default true,
  notify_payment_received boolean not null default true,
  notify_task_due boolean not null default true,
  notify_mentions boolean not null default true,
  notify_weekly_summary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  timezone text not null default 'Asia/Manila' check (char_length(timezone) between 1 and 64),
  country text not null default 'PH' check (country ~ '^[A-Z]{2}$'),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  -- Basis points: 1200 is 12%.
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  payment_term_days integer not null default 15 check (payment_term_days between 0 and 90),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_memberships_user_idx on public.workspace_memberships (user_id) where status = 'active';
-- A workspace has exactly one active owner.
create unique index workspace_memberships_one_owner_idx
  on public.workspace_memberships (workspace_id)
  where role = 'owner' and status = 'active';

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  role public.workspace_role not null check (role <> 'owner'),
  -- SHA-256 of the invitation token. The token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open invitation per email per workspace.
create unique index workspace_invitations_open_idx
  on public.workspace_invitations (workspace_id, email)
  where accepted_at is null and revoked_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event text not null check (event ~ '^[a-z_]+\.[a-z_]+$'),
  target_id uuid,
  detail text not null default '' check (char_length(detail) <= 300),
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces
  for each row execute function private.touch_updated_at();
create trigger workspace_memberships_touch before update on public.workspace_memberships
  for each row execute function private.touch_updated_at();

-- Every new account gets a profile row. The name comes from sign-up metadata
-- and falls back to the part of the email before the @.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  if display_name = '' then
    display_name := split_part(coalesce(new.email, 'New user'), '@', 1);
  end if;
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(coalesce(new.email, '')), left(display_name, 120));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Membership helpers used by policies and functions.
-- Security definer so that policies on workspace_memberships do not recurse.
-- ---------------------------------------------------------------------------

create function private.current_role_in(target_workspace uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.workspace_memberships m
  where m.workspace_id = target_workspace
    and m.user_id = (select auth.uid())
    and m.status = 'active'
$$;

create function private.is_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_role_in(target_workspace) is not null
$$;

create function private.can_manage_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_in(target_workspace) in ('owner', 'admin'), false)
$$;

create function private.shares_workspace_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships mine
    join public.workspace_memberships theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = other_user
      and theirs.status = 'active'
  )
$$;

-- Functions are executable by everyone by default. Close that for this schema,
-- then open only the read-only helpers that the policies need.
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
grant execute on function private.current_role_in(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.can_manage_workspace(uuid) to authenticated;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

create function private.write_audit(target_workspace uuid, event_name text, target uuid, note text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (workspace_id, actor_id, event, target_id, detail)
  values (target_workspace, (select auth.uid()), event_name, target, left(coalesce(note, ''), 300))
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.audit_logs enable row level security;

-- Anonymous visitors get nothing from these tables.
revoke all on public.profiles, public.workspaces, public.workspace_memberships,
  public.workspace_invitations, public.audit_logs from anon;

-- Signed-in users: reads are filtered by the policies below; the only direct
-- writes allowed are a user's own profile and workspace settings.
revoke insert, update, delete, truncate on public.profiles, public.workspaces,
  public.workspace_memberships, public.workspace_invitations, public.audit_logs from authenticated;
grant update (full_name, job_title, timezone, date_format, week_starts_on, notify_invoice_overdue,
  notify_payment_received, notify_task_due, notify_mentions, notify_weekly_summary)
  on public.profiles to authenticated;
grant update (name, timezone, country, currency, tax_rate_bps, payment_term_days)
  on public.workspaces to authenticated;

create policy "Read own profile and teammates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace_with(id));

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members read their workspaces" on public.workspaces
  for select to authenticated
  using (private.is_member(id));

create policy "Owners and admins update workspace settings" on public.workspaces
  for update to authenticated
  using (private.can_manage_workspace(id))
  with check (private.can_manage_workspace(id));

create policy "Members read their workspace's memberships" on public.workspace_memberships
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "Owners and admins read invitations" on public.workspace_invitations
  for select to authenticated
  using (private.can_manage_workspace(workspace_id));

create policy "Owners and admins read the audit log" on public.audit_logs
  for select to authenticated
  using (private.can_manage_workspace(workspace_id));

-- ---------------------------------------------------------------------------
-- Write operations
-- ---------------------------------------------------------------------------

-- Creates a workspace and makes the caller its owner, atomically.
create function public.create_workspace(
  workspace_name text,
  workspace_timezone text,
  workspace_country text,
  workspace_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_id uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.workspaces (name, timezone, country, currency, created_by)
  values (btrim(workspace_name), workspace_timezone, upper(workspace_country), upper(workspace_currency), caller)
  returning id into new_id;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (new_id, caller, 'owner');

  perform private.write_audit(new_id, 'workspace.created', new_id, '');
  return new_id;
end;
$$;

-- Changes another member's role.
--   * Only an owner or admin may do it, and never to themselves.
--   * The owner's role cannot be changed and nobody can be made owner here.
--   * Only the owner can grant or take away the admin role.
create function public.set_member_role(target_membership uuid, new_role public.workspace_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.workspace_memberships%rowtype;
  caller_role public.workspace_role;
begin
  select * into target from public.workspace_memberships where id = target_membership and status = 'active';
  if not found then
    raise exception 'membership_not_found' using errcode = 'P0002';
  end if;

  caller_role := private.current_role_in(target.workspace_id);
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target.user_id = caller then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if target.role = 'owner' or new_role = 'owner' then
    raise exception 'owner_role_is_fixed' using errcode = '42501';
  end if;
  if (target.role = 'admin' or new_role = 'admin') and caller_role <> 'owner' then
    raise exception 'only_owner_manages_admins' using errcode = '42501';
  end if;
  if target.role = new_role then
    return;
  end if;

  update public.workspace_memberships set role = new_role where id = target.id;
  perform private.write_audit(
    target.workspace_id, 'member.role_changed', target.id, target.role::text || ' -> ' || new_role::text
  );
end;
$$;

-- Removes a member. Same authority rules as changing a role.
create function public.remove_member(target_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.workspace_memberships%rowtype;
  caller_role public.workspace_role;
begin
  select * into target from public.workspace_memberships where id = target_membership and status = 'active';
  if not found then
    raise exception 'membership_not_found' using errcode = 'P0002';
  end if;

  caller_role := private.current_role_in(target.workspace_id);
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if target.user_id = caller or target.role = 'owner' then
    raise exception 'cannot_remove_this_member' using errcode = '42501';
  end if;
  if target.role = 'admin' and caller_role <> 'owner' then
    raise exception 'only_owner_manages_admins' using errcode = '42501';
  end if;

  update public.workspace_memberships set status = 'removed' where id = target.id;
  perform private.write_audit(target.workspace_id, 'member.removed', target.id, target.role::text);
end;
$$;

-- Records an invitation. The server generates the token and passes only its hash.
create function public.create_invitation(
  target_workspace uuid,
  invitee_email text,
  invitee_role public.workspace_role,
  invite_token_hash text,
  invite_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_role public.workspace_role := private.current_role_in(target_workspace);
  clean_email text := lower(btrim(invitee_email));
  new_id uuid;
begin
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if invitee_role = 'owner' or (invitee_role = 'admin' and caller_role <> 'owner') then
    raise exception 'role_not_allowed' using errcode = '42501';
  end if;
  if invite_expires_at <= now() or invite_expires_at > now() + interval '30 days' then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.workspace_memberships m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = target_workspace and m.status = 'active' and lower(u.email) = clean_email
  ) then
    raise exception 'already_a_member' using errcode = '23505';
  end if;

  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
  values (target_workspace, clean_email, invitee_role, invite_token_hash, caller, invite_expires_at)
  returning id into new_id;

  perform private.write_audit(target_workspace, 'invitation.created', new_id, invitee_role::text);
  return new_id;
end;
$$;

create function public.revoke_invitation(target_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.workspace_invitations%rowtype;
begin
  select * into invitation from public.workspace_invitations
  where id = target_invitation and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if not private.can_manage_workspace(invitation.workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.workspace_invitations set revoked_at = now() where id = invitation.id;
  perform private.write_audit(invitation.workspace_id, 'invitation.revoked', invitation.id, '');
end;
$$;

-- What the invitation page may show to someone holding a token: the workspace
-- name, the invited address and role, and whether the invitation can still be
-- used. Nothing else about the workspace is revealed.
create function public.get_invitation_preview(invite_token_hash text)
returns table (workspace_name text, email text, role public.workspace_role, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.name,
    i.email,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = invite_token_hash
$$;

-- Accepts an invitation for the signed-in user. Their account email must be
-- the address that was invited, so a forwarded link is useless to anyone else.
create function public.accept_invitation(invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text;
  invitation public.workspace_invitations%rowtype;
  membership_id uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into invitation from public.workspace_invitations
  where token_hash = invite_token_hash
  for update;
  if not found or invitation.revoked_at is not null then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'invitation_already_used' using errcode = '23505';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = '22023';
  end if;

  select lower(u.email) into caller_email from auth.users u where u.id = caller;
  if caller_email is distinct from invitation.email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (invitation.workspace_id, caller, invitation.role)
  on conflict (workspace_id, user_id)
    do update set status = 'active', role = excluded.role
    where public.workspace_memberships.status = 'removed'
  returning id into membership_id;

  if membership_id is null then
    raise exception 'already_a_member' using errcode = '23505';
  end if;

  update public.workspace_invitations
  set accepted_at = now(), accepted_by = caller
  where id = invitation.id;

  perform private.write_audit(invitation.workspace_id, 'invitation.accepted', membership_id, invitation.role::text);
  return invitation.workspace_id;
end;
$$;

-- Only signed-in users may call the write functions. The preview is the one
-- function a visitor without an account may call.
revoke execute on function public.create_workspace(text, text, text, text) from public, anon;
revoke execute on function public.set_member_role(uuid, public.workspace_role) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.create_invitation(uuid, text, public.workspace_role, text, timestamptz) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;

grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.set_member_role(uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workspace_role, text, timestamptz) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
