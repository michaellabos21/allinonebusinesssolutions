-- Deleting a lead for good, for spam and mistakes.
--
-- Managers and above may delete; the table itself still refuses deletes, so it
-- only happens through public.delete_lead. A lead that became a deal is kept as
-- that deal's history. The lead's notifications go with it. Form submission
-- rows stay, without their lead, so the form's rate limits still remember the
-- visitor. The feed records who deleted it.
-- Written so every statement can run again safely.

alter table public.lead_form_submissions alter column lead_id drop not null;
alter table public.lead_form_submissions
  drop constraint if exists lead_form_submissions_lead_id_workspace_id_fkey;
alter table public.lead_form_submissions
  add constraint lead_form_submissions_lead_id_workspace_id_fkey
  foreign key (lead_id, workspace_id) references public.leads (id, workspace_id)
  on delete set null (lead_id);

create or replace function public.delete_lead(target_lead uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lead public.leads;
begin
  select * into lead from public.leads l where l.id = target_lead for update;
  if lead.id is null or not private.can_manage_records(lead.workspace_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.deals d where d.lead_id = lead.id) then
    raise exception 'lead_has_deal' using errcode = '23503';
  end if;

  delete from public.leads l where l.id = lead.id;

  insert into public.activities (workspace_id, actor_id, kind, summary, href)
  values (lead.workspace_id, (select auth.uid()), 'lead',
    left('deleted the lead ' || lead.name, 300), '/crm/leads');
end;
$$;

revoke execute on function public.delete_lead(uuid) from public;
grant execute on function public.delete_lead(uuid) to authenticated;
