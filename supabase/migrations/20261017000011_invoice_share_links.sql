-- Share an invoice with a client by link: Messenger, Viber, SMS or email.
--
-- Each issued invoice can have one secret link (/i/<token>). Anyone with the
-- link sees that invoice and nothing else: the business name, the bill-to as
-- issued, the lines, totals, what is paid and what is still owed. Drafts are
-- never shared. Resetting a link turns the old one off for good.
-- Written so every statement can run again safely.

create table if not exists public.invoice_share_links (
  invoice_id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 36 hex characters, unguessable. The only thing in the link.
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, workspace_id) references public.invoices (id, workspace_id) on delete cascade
);

alter table public.invoice_share_links enable row level security;
revoke all on public.invoice_share_links from anon;
revoke insert, update, delete, truncate on public.invoice_share_links from authenticated;
drop policy if exists "Finance reads share links" on public.invoice_share_links;
create policy "Finance reads share links" on public.invoice_share_links
  for select to authenticated using (private.can_manage_finance(workspace_id));

-- Returns the invoice's link token, making one the first time. Finance roles only.
create or replace function public.share_invoice(target_invoice uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  link_token text;
begin
  select * into inv from public.invoices i where i.id = target_invoice;
  if inv.id is null or not private.can_manage_finance(inv.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if inv.status = 'draft' then
    raise exception 'issue_before_sharing' using errcode = '23514';
  end if;

  insert into public.invoice_share_links (invoice_id, workspace_id, created_by)
  values (inv.id, inv.workspace_id, (select auth.uid()))
  on conflict (invoice_id) do nothing;
  select l.token into link_token from public.invoice_share_links l where l.invoice_id = inv.id;
  return link_token;
end;
$$;

-- Turns the current link off; sharing again makes a new one.
create or replace function public.reset_invoice_share_link(target_invoice uuid)
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
  delete from public.invoice_share_links l where l.invoice_id = target_invoice;
end;
$$;

-- What a client sees at /i/<token>. Null for an unknown link or a draft.
create or replace function public.get_shared_invoice(link_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', w.name,
    'number', i.number,
    'status', i.status,
    'currency', i.currency,
    'issued_on', i.issued_on,
    'due_on', i.due_on,
    'today', private.workspace_today(i.workspace_id),
    'bill_to', i.bill_to,
    'subtotal_minor', i.subtotal_minor,
    'discount_minor', i.discount_minor,
    'tax_rate_bps', i.tax_rate_bps,
    'tax_minor', i.tax_minor,
    'total_minor', i.total_minor,
    'paid_minor', i.paid_minor,
    'notes', i.notes,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', it.id,
        'description', it.description,
        'quantity_milli', it.quantity_milli,
        'unit_price_minor', it.unit_price_minor,
        'amount_minor', it.amount_minor
      ) order by it.position)
      from public.invoice_items it where it.invoice_id = i.id
    ), '[]'::jsonb)
  )
  from public.invoice_share_links l
  join public.invoices i on i.id = l.invoice_id
  join public.workspaces w on w.id = i.workspace_id
  where l.token = link_token and i.status <> 'draft'
$$;

revoke execute on function public.share_invoice(uuid) from public;
revoke execute on function public.reset_invoice_share_link(uuid) from public;
revoke execute on function public.get_shared_invoice(text) from public;
grant execute on function public.share_invoice(uuid) to authenticated;
grant execute on function public.reset_invoice_share_link(uuid) to authenticated;
grant execute on function public.get_shared_invoice(text) to anon, authenticated;
