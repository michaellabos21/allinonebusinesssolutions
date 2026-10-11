-- Backend Phase 4: estimates, invoices, line items, manual payments, expenses
-- and private receipt files.
--
-- Access: finance is for owners, admins and managers. Members and clients see
-- none of it, because amounts owed and paid are sensitive.
--
-- Estimates, invoices, their items and payments are read-only tables for
-- users. Every change goes through a security-definer function below that
-- re-checks the caller's role, computes totals itself, allocates numbers and
-- allows only the documented status transitions:
--
--   invoice   draft -> sent -> partially_paid -> paid
--             sent  -> void (only while nothing has been paid)
--             draft -> deleted
--   estimate  draft -> sent -> accepted | declined;  accepted -> invoice draft
--
-- "Overdue" and "expired" are not stored; they follow from the due date and
-- validity date, so they can never be stale.
--
-- Money is bigint minor units with an ISO currency code. Quantities are
-- thousandths of a unit (1.5 hours = 1500). A line's amount is rounded once,
-- half away from zero; tax is applied to the discounted subtotal and rounded
-- once. `src/lib/money.ts` implements the same arithmetic for previews, and the
-- tests check that the two agree.
--
-- Nothing here is a statement of tax or accounting compliance.

create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'void');
create type public.estimate_status as enum ('draft', 'sent', 'accepted', 'declined');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'e_wallet', 'check', 'other');

-- ---------------------------------------------------------------------------
-- Role helper and workspace settings
-- ---------------------------------------------------------------------------

create function private.can_manage_finance(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role_in(target_workspace) in ('owner', 'admin', 'manager'), false)
$$;
grant execute on function private.can_manage_finance(uuid) to authenticated;

alter table public.workspaces
  add column invoice_prefix text not null default 'INV-' check (invoice_prefix ~ '^[A-Za-z0-9/-]{0,12}$'),
  add column estimate_prefix text not null default 'EST-' check (estimate_prefix ~ '^[A-Za-z0-9/-]{0,12}$');
grant update (invoice_prefix, estimate_prefix) on public.workspaces to authenticated;

-- One counter per workspace and document type. Taking the next number locks
-- the counter's row until the transaction ends, so two people issuing at the
-- same moment get different numbers, and a failed issue gives its number back.
create table public.document_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'estimate')),
  next_number integer not null default 1 check (next_number > 0),
  primary key (workspace_id, kind)
);
alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon, authenticated;

create function private.take_document_number(target_workspace uuid, document_kind text)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.document_counters as c (workspace_id, kind, next_number)
  values (target_workspace, document_kind, 2)
  on conflict (workspace_id, kind) do update set next_number = c.next_number + 1
  returning c.next_number - 1
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number text,
  contact_id uuid,
  status public.estimate_status not null default 'draft',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issued_on date not null default current_date,
  valid_until date not null,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  notes text not null default '' check (char_length(notes) <= 2000),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor between 0 and 10000000000000),
  converted_invoice_id uuid,
  sent_at timestamptz,
  decided_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, number),
  foreign key (contact_id, workspace_id) references public.contacts (id, workspace_id),
  check ((status = 'draft') = (number is null)),
  check (valid_until >= issued_on)
);
create index estimates_workspace_idx on public.estimates (workspace_id, issued_on desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Given when the invoice is issued; drafts have none.
  number text,
  contact_id uuid,
  -- Who the invoice was addressed to when issued, kept even if the contact changes.
  bill_to jsonb not null default '{}'::jsonb,
  status public.invoice_status not null default 'draft',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issued_on date not null default current_date,
  due_on date not null,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  notes text not null default '' check (char_length(notes) <= 2000),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor between 0 and 10000000000000),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  estimate_id uuid,
  sent_at timestamptz,
  voided_at timestamptz,
  void_reason text not null default '' check (char_length(void_reason) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, number),
  foreign key (contact_id, workspace_id) references public.contacts (id, workspace_id),
  foreign key (estimate_id, workspace_id) references public.estimates (id, workspace_id),
  check (paid_minor <= total_minor),
  check ((status = 'draft') = (number is null)),
  check (due_on >= issued_on)
);
create index invoices_workspace_idx on public.invoices (workspace_id, issued_on desc);

alter table public.estimates
  add foreign key (converted_invoice_id, workspace_id) references public.invoices (id, workspace_id);

-- Line items for both document types share one shape.
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid not null,
  position integer not null check (position between 0 and 199),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  quantity_milli bigint not null check (quantity_milli between 1 and 100000000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 100000000000),
  amount_minor bigint not null check (amount_minor >= 0),
  catalog_item_id uuid references public.products_services (id) on delete set null,
  foreign key (invoice_id, workspace_id) references public.invoices (id, workspace_id) on delete cascade,
  unique (invoice_id, position)
);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  estimate_id uuid not null,
  position integer not null check (position between 0 and 199),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  quantity_milli bigint not null check (quantity_milli between 1 and 100000000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 100000000000),
  amount_minor bigint not null check (amount_minor >= 0),
  catalog_item_id uuid references public.products_services (id) on delete set null,
  foreign key (estimate_id, workspace_id) references public.estimates (id, workspace_id) on delete cascade,
  unique (estimate_id, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  paid_on date not null,
  method public.payment_method not null,
  reference text not null default '' check (char_length(reference) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, workspace_id) references public.invoices (id, workspace_id) on delete cascade
);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_workspace_idx on public.payments (workspace_id, paid_on desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  spent_on date not null,
  vendor text not null check (char_length(btrim(vendor)) between 1 and 120),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  amount_minor bigint not null check (amount_minor between 1 and 10000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_method public.payment_method not null default 'other',
  notes text not null default '' check (char_length(notes) <= 2000),
  project_id uuid,
  -- Path of the receipt in the private "receipts" bucket: <workspace>/<expense>/<file>.
  receipt_path text check (receipt_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id),
  -- A receipt always sits under its own workspace and expense.
  check (receipt_path is null or receipt_path like workspace_id::text || '/' || id::text || '/%')
);
create index expenses_workspace_idx on public.expenses (workspace_id, spent_on desc);

create trigger estimates_touch before update on public.estimates
  for each row execute function private.touch_updated_at();
create trigger invoices_touch before update on public.invoices
  for each row execute function private.touch_updated_at();
create trigger expenses_identity before insert or update on public.expenses
  for each row execute function private.guard_identity();
create trigger expenses_touch before update on public.expenses
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: finance is read by managers and above, and only
-- expenses are written directly.
-- ---------------------------------------------------------------------------

alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

revoke all on public.estimates, public.estimate_items, public.invoices, public.invoice_items,
  public.payments, public.expenses from anon;
revoke insert, update, delete, truncate on public.estimates, public.estimate_items,
  public.invoices, public.invoice_items, public.payments from authenticated;
revoke delete, truncate on public.expenses from authenticated;

create policy "Finance reads estimates" on public.estimates
  for select to authenticated using (private.can_manage_finance(workspace_id));
create policy "Finance reads estimate items" on public.estimate_items
  for select to authenticated using (private.can_manage_finance(workspace_id));
create policy "Finance reads invoices" on public.invoices
  for select to authenticated using (private.can_manage_finance(workspace_id));
create policy "Finance reads invoice items" on public.invoice_items
  for select to authenticated using (private.can_manage_finance(workspace_id));
create policy "Finance reads payments" on public.payments
  for select to authenticated using (private.can_manage_finance(workspace_id));

create policy "Finance reads expenses" on public.expenses
  for select to authenticated using (private.can_manage_finance(workspace_id));
create policy "Finance adds expenses" on public.expenses
  for insert to authenticated with check (private.can_manage_finance(workspace_id));
create policy "Finance edits expenses" on public.expenses
  for update to authenticated
  using (private.can_manage_finance(workspace_id))
  with check (private.can_manage_finance(workspace_id));

-- ---------------------------------------------------------------------------
-- Line items and totals
-- ---------------------------------------------------------------------------

-- One line's amount: quantity (thousandths) times unit price, rounded once.
create function private.line_amount(quantity_milli bigint, unit_price_minor bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select round(quantity_milli::numeric * unit_price_minor / 1000)::bigint
$$;

-- Validates the items a client sent. Returns them normalised; raises on any
-- problem. Amounts sent by the client are ignored.
create function private.parse_items(items jsonb, target_workspace uuid)
returns table (
  line_no integer,
  description text,
  quantity_milli bigint,
  unit_price_minor bigint,
  amount_minor bigint,
  catalog_item_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  item jsonb;
  i integer := 0;
  item_catalog uuid;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 100 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(item -> 'quantityMilli') <> 'number'
      or jsonb_typeof(item -> 'unitPriceMinor') <> 'number'
      or (item ->> 'quantityMilli')::numeric <> trunc((item ->> 'quantityMilli')::numeric)
      or (item ->> 'unitPriceMinor')::numeric <> trunc((item ->> 'unitPriceMinor')::numeric) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    item_catalog := nullif(item ->> 'catalogItemId', '')::uuid;
    if item_catalog is not null and not exists (
      select 1 from public.products_services p
      where p.id = item_catalog and p.workspace_id = target_workspace
    ) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    line_no := i;
    description := btrim(coalesce(item ->> 'description', ''));
    quantity_milli := (item ->> 'quantityMilli')::bigint;
    unit_price_minor := (item ->> 'unitPriceMinor')::bigint;
    amount_minor := private.line_amount(quantity_milli, unit_price_minor);
    catalog_item_id := item_catalog;
    return next;
    i := i + 1;
  end loop;
end;
$$;

-- Totals from the stored lines: subtotal, then the discount (never below
-- zero), then tax on what is left, rounded once.
create function private.totals(subtotal bigint, discount bigint, tax_bps integer)
returns table (discount_minor bigint, tax_minor bigint, total_minor bigint)
language sql
immutable
set search_path = ''
as $$
  select d, t, subtotal - d + t
  from (select least(greatest(discount, 0), subtotal) as d) as clamp,
  lateral (select round((subtotal - d)::numeric * tax_bps / 10000)::bigint as t) as taxed
$$;

create function private.total_invoice(target_invoice uuid, discount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subtotal bigint;
  tax_bps integer;
begin
  select coalesce(sum(it.amount_minor), 0) into subtotal
  from public.invoice_items it where it.invoice_id = target_invoice;
  select i.tax_rate_bps into tax_bps from public.invoices i where i.id = target_invoice;
  update public.invoices i
  set subtotal_minor = subtotal, discount_minor = t.discount_minor,
      tax_minor = t.tax_minor, total_minor = t.total_minor
  from private.totals(subtotal, discount, tax_bps) t
  where i.id = target_invoice;
end;
$$;

create function private.total_estimate(target_estimate uuid, discount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subtotal bigint;
  tax_bps integer;
begin
  select coalesce(sum(ei.amount_minor), 0) into subtotal
  from public.estimate_items ei where ei.estimate_id = target_estimate;
  select e.tax_rate_bps into tax_bps from public.estimates e where e.id = target_estimate;
  update public.estimates e
  set subtotal_minor = subtotal, discount_minor = t.discount_minor,
      tax_minor = t.tax_minor, total_minor = t.total_minor
  from private.totals(subtotal, discount, tax_bps) t
  where e.id = target_estimate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

-- Creates or replaces a draft invoice: header, items and totals in one step.
-- Returns its id. Only drafts can be changed.
create function public.save_invoice_draft(
  target_workspace uuid,
  target_invoice uuid,
  header jsonb,
  items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_id uuid := target_invoice;
  ws_currency text;
  contact uuid := nullif(header ->> 'contactId', '')::uuid;
begin
  if not private.can_manage_finance(target_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if contact is not null and not exists (
    select 1 from public.contacts c where c.id = contact and c.workspace_id = target_workspace
  ) then
    raise exception 'contact_not_found' using errcode = 'P0002';
  end if;
  select w.currency into ws_currency from public.workspaces w where w.id = target_workspace;

  if doc_id is null then
    insert into public.invoices (
      workspace_id, contact_id, currency, issued_on, due_on, tax_rate_bps, notes, created_by
    )
    values (
      target_workspace, contact, ws_currency, (header ->> 'issuedOn')::date,
      (header ->> 'dueOn')::date, coalesce((header ->> 'taxRateBps')::integer, 0),
      coalesce(header ->> 'notes', ''), (select auth.uid())
    )
    returning id into doc_id;
  else
    update public.invoices i
    set contact_id = contact, issued_on = (header ->> 'issuedOn')::date,
        due_on = (header ->> 'dueOn')::date,
        tax_rate_bps = coalesce((header ->> 'taxRateBps')::integer, 0),
        notes = coalesce(header ->> 'notes', '')
    where i.id = doc_id and i.workspace_id = target_workspace and i.status = 'draft';
    if not found then
      raise exception 'not_a_draft' using errcode = '23514';
    end if;
    delete from public.invoice_items it where it.invoice_id = doc_id;
  end if;

  insert into public.invoice_items (
    workspace_id, invoice_id, position, description, quantity_milli, unit_price_minor,
    amount_minor, catalog_item_id
  )
  select target_workspace, doc_id, p.line_no, p.description, p.quantity_milli,
    p.unit_price_minor, p.amount_minor, p.catalog_item_id
  from private.parse_items(items, target_workspace) p;

  perform private.total_invoice(doc_id, coalesce((header ->> 'discountMinor')::bigint, 0));
  return doc_id;
end;
$$;

create function public.delete_invoice_draft(target_invoice uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select i.workspace_id into ws from public.invoices i where i.id = target_invoice;
  if ws is null or not private.can_manage_finance(ws) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.invoices i where i.id = target_invoice and i.status = 'draft';
  if not found then
    raise exception 'not_a_draft' using errcode = '23514';
  end if;
end;
$$;

-- Issues a draft: gives it the next number, records who it is addressed to,
-- and makes it final. Returns the number.
create function public.issue_invoice(target_invoice uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  prefix text;
  new_number text;
  recipient jsonb;
begin
  select * into inv from public.invoices i where i.id = target_invoice for update;
  if inv.id is null or not private.can_manage_finance(inv.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if inv.status <> 'draft' then
    raise exception 'not_a_draft' using errcode = '23514';
  end if;
  if inv.contact_id is null then
    raise exception 'bill_to_required' using errcode = '23514';
  end if;
  if inv.total_minor <= 0 then
    raise exception 'total_required' using errcode = '23514';
  end if;

  select jsonb_build_object('name', c.name, 'email', c.email, 'company', coalesce(co.name, ''),
           'address', coalesce(co.address, ''))
    into recipient
  from public.contacts c
  left join public.companies co on co.id = c.company_id
  where c.id = inv.contact_id;

  select w.invoice_prefix into prefix from public.workspaces w where w.id = inv.workspace_id;
  new_number := prefix || lpad(private.take_document_number(inv.workspace_id, 'invoice')::text, 4, '0');

  update public.invoices
  set status = 'sent', number = new_number, bill_to = recipient, sent_at = now()
  where id = inv.id;

  perform private.write_audit(inv.workspace_id, 'invoice.issued', inv.id,
    new_number || ' for ' || inv.currency || ' ' || (inv.total_minor / 100.0)::text);
  return new_number;
end;
$$;

-- Records a manual payment. Partial payments are fine; paying more than is
-- outstanding is refused, so there is never an unexplained credit.
create function public.record_payment(
  target_invoice uuid,
  amount bigint,
  paid date,
  pay_method public.payment_method,
  pay_reference text,
  pay_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  payment_id uuid;
  new_paid bigint;
begin
  select * into inv from public.invoices i where i.id = target_invoice for update;
  if inv.id is null or not private.can_manage_finance(inv.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if inv.status not in ('sent', 'partially_paid') then
    raise exception 'not_payable' using errcode = '23514';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if amount > inv.total_minor - inv.paid_minor then
    raise exception 'overpayment' using errcode = '23514';
  end if;
  if paid is null or paid > current_date + 1 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  insert into public.payments (workspace_id, invoice_id, amount_minor, paid_on, method, reference, note, recorded_by)
  values (inv.workspace_id, inv.id, amount, paid, pay_method,
    left(btrim(coalesce(pay_reference, '')), 120), left(btrim(coalesce(pay_note, '')), 500), (select auth.uid()))
  returning id into payment_id;

  new_paid := inv.paid_minor + amount;
  update public.invoices
  set paid_minor = new_paid,
      status = case when new_paid = inv.total_minor then 'paid'::public.invoice_status else 'partially_paid' end
  where id = inv.id;

  perform private.write_audit(inv.workspace_id, 'invoice.payment_recorded', inv.id,
    inv.number || ': ' || inv.currency || ' ' || (amount / 100.0)::text);
  return payment_id;
end;
$$;

-- Cancels an issued invoice. Its number stays used. Refused once any payment
-- is recorded: money received needs a refund, which is outside this phase.
create function public.void_invoice(target_invoice uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices i where i.id = target_invoice for update;
  if inv.id is null or not private.can_manage_finance(inv.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if inv.status = 'draft' then
    raise exception 'not_issued' using errcode = '23514';
  elsif inv.status <> 'sent' then
    raise exception 'has_payments' using errcode = '23514';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.invoices
  set status = 'void', voided_at = now(), void_reason = left(btrim(reason), 300)
  where id = inv.id;
  perform private.write_audit(inv.workspace_id, 'invoice.voided', inv.id,
    inv.number || ': ' || left(btrim(reason), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- Estimates
-- ---------------------------------------------------------------------------

create function public.save_estimate_draft(
  target_workspace uuid,
  target_estimate uuid,
  header jsonb,
  items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_id uuid := target_estimate;
  ws_currency text;
  contact uuid := nullif(header ->> 'contactId', '')::uuid;
begin
  if not private.can_manage_finance(target_workspace) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if contact is not null and not exists (
    select 1 from public.contacts c where c.id = contact and c.workspace_id = target_workspace
  ) then
    raise exception 'contact_not_found' using errcode = 'P0002';
  end if;
  select w.currency into ws_currency from public.workspaces w where w.id = target_workspace;

  if doc_id is null then
    insert into public.estimates (
      workspace_id, contact_id, currency, issued_on, valid_until, tax_rate_bps, notes, created_by
    )
    values (
      target_workspace, contact, ws_currency, (header ->> 'issuedOn')::date,
      (header ->> 'validUntil')::date, coalesce((header ->> 'taxRateBps')::integer, 0),
      coalesce(header ->> 'notes', ''), (select auth.uid())
    )
    returning id into doc_id;
  else
    update public.estimates e
    set contact_id = contact, issued_on = (header ->> 'issuedOn')::date,
        valid_until = (header ->> 'validUntil')::date,
        tax_rate_bps = coalesce((header ->> 'taxRateBps')::integer, 0),
        notes = coalesce(header ->> 'notes', '')
    where e.id = doc_id and e.workspace_id = target_workspace and e.status = 'draft';
    if not found then
      raise exception 'not_a_draft' using errcode = '23514';
    end if;
    delete from public.estimate_items ei where ei.estimate_id = doc_id;
  end if;

  insert into public.estimate_items (
    workspace_id, estimate_id, position, description, quantity_milli, unit_price_minor,
    amount_minor, catalog_item_id
  )
  select target_workspace, doc_id, p.line_no, p.description, p.quantity_milli,
    p.unit_price_minor, p.amount_minor, p.catalog_item_id
  from private.parse_items(items, target_workspace) p;

  perform private.total_estimate(doc_id, coalesce((header ->> 'discountMinor')::bigint, 0));
  return doc_id;
end;
$$;

create function public.delete_estimate_draft(target_estimate uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select e.workspace_id into ws from public.estimates e where e.id = target_estimate;
  if ws is null or not private.can_manage_finance(ws) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.estimates e where e.id = target_estimate and e.status = 'draft';
  if not found then
    raise exception 'not_a_draft' using errcode = '23514';
  end if;
end;
$$;

create function public.send_estimate(target_estimate uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  est public.estimates;
  prefix text;
  new_number text;
begin
  select * into est from public.estimates e where e.id = target_estimate for update;
  if est.id is null or not private.can_manage_finance(est.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if est.status <> 'draft' then
    raise exception 'not_a_draft' using errcode = '23514';
  end if;
  if est.contact_id is null then
    raise exception 'bill_to_required' using errcode = '23514';
  end if;
  if est.total_minor <= 0 then
    raise exception 'total_required' using errcode = '23514';
  end if;
  select w.estimate_prefix into prefix from public.workspaces w where w.id = est.workspace_id;
  new_number := prefix || lpad(private.take_document_number(est.workspace_id, 'estimate')::text, 4, '0');
  update public.estimates set status = 'sent', number = new_number, sent_at = now() where id = est.id;
  return new_number;
end;
$$;

-- Records the client's answer to a sent estimate.
create function public.decide_estimate(target_estimate uuid, accepted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  est public.estimates;
begin
  select * into est from public.estimates e where e.id = target_estimate for update;
  if est.id is null or not private.can_manage_finance(est.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if est.status <> 'sent' then
    raise exception 'not_sent' using errcode = '23514';
  end if;
  update public.estimates
  set status = case when accepted then 'accepted'::public.estimate_status else 'declined' end,
      decided_at = now()
  where id = est.id;
end;
$$;

-- Turns an accepted estimate into a draft invoice with the same lines, once.
create function public.convert_estimate_to_invoice(target_estimate uuid, due date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  est public.estimates;
  doc_id uuid;
begin
  select * into est from public.estimates e where e.id = target_estimate for update;
  if est.id is null or not private.can_manage_finance(est.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if est.status <> 'accepted' then
    raise exception 'not_accepted' using errcode = '23514';
  end if;
  if est.converted_invoice_id is not null then
    raise exception 'already_converted' using errcode = '23514';
  end if;

  insert into public.invoices (
    workspace_id, contact_id, currency, issued_on, due_on, discount_minor, tax_rate_bps, notes,
    subtotal_minor, tax_minor, total_minor, estimate_id, created_by
  )
  values (
    est.workspace_id, est.contact_id, est.currency, current_date, greatest(due, current_date),
    est.discount_minor, est.tax_rate_bps, est.notes, est.subtotal_minor, est.tax_minor,
    est.total_minor, est.id, (select auth.uid())
  )
  returning id into doc_id;

  insert into public.invoice_items (
    workspace_id, invoice_id, position, description, quantity_milli, unit_price_minor,
    amount_minor, catalog_item_id
  )
  select ei.workspace_id, doc_id, ei.position, ei.description, ei.quantity_milli,
    ei.unit_price_minor, ei.amount_minor, ei.catalog_item_id
  from public.estimate_items ei where ei.estimate_id = est.id;

  update public.estimates set converted_invoice_id = doc_id where id = est.id;
  return doc_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: the public gets none of this.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.save_invoice_draft(uuid, uuid, jsonb, jsonb),
  public.delete_invoice_draft(uuid),
  public.issue_invoice(uuid),
  public.record_payment(uuid, bigint, date, public.payment_method, text, text),
  public.void_invoice(uuid, text),
  public.save_estimate_draft(uuid, uuid, jsonb, jsonb),
  public.delete_estimate_draft(uuid),
  public.send_estimate(uuid),
  public.decide_estimate(uuid, boolean),
  public.convert_estimate_to_invoice(uuid, date)
from public, anon;
grant execute on function
  public.save_invoice_draft(uuid, uuid, jsonb, jsonb),
  public.delete_invoice_draft(uuid),
  public.issue_invoice(uuid),
  public.record_payment(uuid, bigint, date, public.payment_method, text, text),
  public.void_invoice(uuid, text),
  public.save_estimate_draft(uuid, uuid, jsonb, jsonb),
  public.delete_estimate_draft(uuid),
  public.send_estimate(uuid),
  public.decide_estimate(uuid, boolean),
  public.convert_estimate_to_invoice(uuid, date)
to authenticated;

-- ---------------------------------------------------------------------------
-- Receipts: a private storage bucket, readable and writable only by finance
-- staff of the workspace named in the file's first folder.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage is not enabled; receipt uploads are unavailable.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts', 'receipts', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $policy$
    create policy "Finance reads receipts" on storage.objects for select to authenticated
    using (bucket_id = 'receipts'
      and private.can_manage_finance(((storage.foldername(name))[1])::uuid))
  $policy$;
  execute $policy$
    create policy "Finance uploads receipts" on storage.objects for insert to authenticated
    with check (bucket_id = 'receipts'
      and private.can_manage_finance(((storage.foldername(name))[1])::uuid))
  $policy$;
  execute $policy$
    create policy "Finance removes receipts" on storage.objects for delete to authenticated
    using (bucket_id = 'receipts'
      and private.can_manage_finance(((storage.foldername(name))[1])::uuid))
  $policy$;
end;
$$;
