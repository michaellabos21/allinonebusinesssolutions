-- Lead forms you can shape: your own fields, your colour and button, an
-- optional redirect, a way to embed the form on your own website, and a record
-- of where each enquiry came from.
--
--   lead_forms.fields        the questions, in order (validated below)
--   lead_forms.accent_color  button and focus colour on the public form
--   lead_forms.button_label  the send button's text
--   lead_forms.redirect_url  optional https page to open after sending
--   leads.answers            answers to the form's own questions, as asked
--   leads.attribution        UTM tags, referrer and the page the form was on
--   lead_form_view_days      daily view counts, for conversion rates
--
-- Answers and attribution are written only by public.submit_lead_form and can
-- never be edited, so they always show what the visitor actually sent.
-- Written so every statement can run again safely.

-- ---------------------------------------------------------------------------
-- The field list
-- ---------------------------------------------------------------------------

-- A form always asks for a name and an email (a lead needs both to become a
-- contact). Phone, company and message map to the lead's own columns and may
-- be removed. Any other question is a custom field, keyed c_<random>, whose
-- answer is kept on the lead as asked.
create or replace function private.valid_lead_form_fields(fields jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  field jsonb;
  field_key text;
  field_type text;
  fixed_type text;
  options jsonb;
  seen text[] := '{}';
begin
  if jsonb_typeof(fields) <> 'array' or jsonb_array_length(fields) not between 2 and 25 then
    return false;
  end if;
  for field in select value from jsonb_array_elements(fields) loop
    if jsonb_typeof(field) <> 'object' then return false; end if;
    field_key := field ->> 'key';
    field_type := field ->> 'type';
    if field_key is null or field_key !~ '^(name|email|phone|company|message|c_[a-z0-9]{6,12})$'
      or field_key = any (seen) then
      return false;
    end if;
    seen := seen || field_key;

    fixed_type := case field_key
      when 'name' then 'short_text' when 'email' then 'email' when 'phone' then 'phone'
      when 'company' then 'short_text' when 'message' then 'long_text' end;
    if field_type is null
      or field_type not in ('short_text', 'long_text', 'email', 'phone', 'dropdown', 'checkboxes', 'date')
      or (fixed_type is not null and field_type <> fixed_type) then
      return false;
    end if;

    if jsonb_typeof(field -> 'label') <> 'string'
      or char_length(btrim(field ->> 'label')) not between 1 and 80
      or jsonb_typeof(field -> 'required') <> 'boolean'
      or (field_key in ('name', 'email') and (field ->> 'required') <> 'true')
      or (field ? 'placeholder' and (jsonb_typeof(field -> 'placeholder') <> 'string'
        or char_length(field ->> 'placeholder') > 120)) then
      return false;
    end if;

    options := field -> 'options';
    if field_type in ('dropdown', 'checkboxes') then
      if options is null or jsonb_typeof(options) <> 'array'
        or jsonb_array_length(options) not between 1 and 30
        or exists (
          select 1 from jsonb_array_elements(options) o
          where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 80
        )
        or (select count(distinct o #>> '{}') from jsonb_array_elements(options) o)
          <> jsonb_array_length(options) then
        return false;
      end if;
    elsif options is not null and options <> '[]'::jsonb then
      return false;
    end if;
  end loop;
  return 'name' = any (seen) and 'email' = any (seen);
end;
$$;

alter table public.lead_forms
  add column if not exists fields jsonb not null default '[
    {"key": "name", "type": "short_text", "label": "Your name", "required": true},
    {"key": "email", "type": "email", "label": "Email", "required": true},
    {"key": "phone", "type": "phone", "label": "Phone", "required": false},
    {"key": "company", "type": "short_text", "label": "Company", "required": false},
    {"key": "message", "type": "long_text", "label": "How can we help?", "required": false}
  ]'::jsonb,
  add column if not exists accent_color text not null default '#34479e',
  add column if not exists button_label text not null default 'Send',
  add column if not exists redirect_url text not null default '';

alter table public.lead_forms drop constraint if exists lead_forms_fields_check;
alter table public.lead_forms add constraint lead_forms_fields_check
  check (private.valid_lead_form_fields(fields));
alter table public.lead_forms drop constraint if exists lead_forms_accent_color_check;
alter table public.lead_forms add constraint lead_forms_accent_color_check
  check (accent_color ~ '^#[0-9a-f]{6}$');
alter table public.lead_forms drop constraint if exists lead_forms_button_label_check;
alter table public.lead_forms add constraint lead_forms_button_label_check
  check (char_length(btrim(button_label)) between 1 and 40);
-- https only, so a form can never send a visitor to a script or a plain-http page.
alter table public.lead_forms drop constraint if exists lead_forms_redirect_url_check;
alter table public.lead_forms add constraint lead_forms_redirect_url_check
  check (redirect_url = '' or (redirect_url ~ '^https://[^\s]+$' and char_length(redirect_url) <= 500));

-- ---------------------------------------------------------------------------
-- What arrived with each lead
-- ---------------------------------------------------------------------------

alter table public.leads
  -- [{ "key", "label", "value" }] in the form's order; checkbox answers joined with ", ".
  add column if not exists answers jsonb not null default '[]'::jsonb,
  -- Any of utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, page_url.
  add column if not exists attribution jsonb not null default '{}'::jsonb;

alter table public.leads drop constraint if exists leads_answers_check;
alter table public.leads add constraint leads_answers_check
  check (jsonb_typeof(answers) = 'array' and pg_column_size(answers) <= 32000);
alter table public.leads drop constraint if exists leads_attribution_check;
alter table public.leads add constraint leads_attribution_check
  check (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) <= 4000);

create or replace function private.guard_lead_enquiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.lead_form', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.answers <> '[]'::jsonb or new.attribution <> '{}'::jsonb)
    or tg_op = 'UPDATE' and (new.answers is distinct from old.answers
      or new.attribution is distinct from old.attribution) then
    raise exception 'immutable_column' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_enquiry on public.leads;
create trigger leads_enquiry before insert or update on public.leads
  for each row execute function private.guard_lead_enquiry();

-- ---------------------------------------------------------------------------
-- Views, counted per form per day (UTC)
-- ---------------------------------------------------------------------------

create table if not exists public.lead_form_view_days (
  form_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (form_id, day),
  foreign key (form_id, workspace_id) references public.lead_forms (id, workspace_id)
);

alter table public.lead_form_view_days enable row level security;
revoke all on public.lead_form_view_days from anon;
revoke insert, update, delete, truncate on public.lead_form_view_days from authenticated;
drop policy if exists "Team reads form views" on public.lead_form_view_days;
create policy "Team reads form views" on public.lead_form_view_days
  for select to authenticated using (private.can_use_records(workspace_id));

-- Called once per visit by the public form page. Anyone can call it, so a
-- count can be inflated on purpose; it is a guide, not an audit figure.
create or replace function public.record_lead_form_view(form_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.lead_form_view_days (form_id, workspace_id, day, views)
  select f.id, f.workspace_id, (now() at time zone 'utc')::date, 1
  from public.lead_forms f
  where f.token = form_token and f.active
  on conflict (form_id, day) do update
    set views = least(public.lead_form_view_days.views + 1, 1000000)
$$;

revoke execute on function public.record_lead_form_view(text) from public;
grant execute on function public.record_lead_form_view(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The public form
-- ---------------------------------------------------------------------------

-- The return type changes, so the old function goes first.
drop function if exists public.get_lead_form(text);
create function public.get_lead_form(form_token text)
returns table (
  form_name text, business_name text, intro text, consent_text text,
  fields jsonb, accent_color text, button_label text, redirect_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, w.name, f.intro, f.consent_text, f.fields, f.accent_color, f.button_label, f.redirect_url
  from public.lead_forms f
  join public.workspaces w on w.id = f.workspace_id
  where f.token = form_token and f.active
$$;

revoke execute on function public.get_lead_form(text) from public;
grant execute on function public.get_lead_form(text) to anon, authenticated;

-- Accepts one submission. The workspace comes from the form's token, never
-- from the visitor, and every answer is checked against the form's own field
-- list. Payload: { values: { <field key>: text | [text] }, consent, attribution }.
-- Older pages sent name, email, phone, company and message at the top level;
-- those are still read. Limits: 3 per visitor per form in 10 minutes and 100
-- per form per hour. Returns only the thank-you message.
create or replace function public.submit_lead_form(form_token text, payload jsonb, client_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  form public.lead_forms;
  field jsonb;
  field_key text;
  field_type text;
  raw jsonb;
  answer text;
  picked text[];
  values_in jsonb := coalesce(payload -> 'values', '{}'::jsonb);
  lead_name text := '';
  lead_email text := '';
  lead_phone text := '';
  lead_company text := '';
  lead_message text := '';
  custom_answers jsonb := '[]'::jsonb;
  source_in jsonb := coalesce(payload -> 'attribution', '{}'::jsonb);
  attribution_out jsonb := '{}'::jsonb;
  attribution_key text;
  new_lead uuid;
begin
  select * into form from public.lead_forms f where f.token = form_token and f.active;
  if form.id is null then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  if client_key is null or char_length(client_key) not between 1 and 128
    or jsonb_typeof(values_in) <> 'object' then
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

  for field in select value from jsonb_array_elements(form.fields) loop
    field_key := field ->> 'key';
    field_type := field ->> 'type';
    raw := coalesce(values_in -> field_key, payload -> field_key);
    answer := '';
    picked := '{}';

    if field_type = 'checkboxes' then
      if raw is not null and jsonb_typeof(raw) = 'array' then
        select coalesce(array_agg(distinct btrim(v #>> '{}')), '{}') into picked
        from jsonb_array_elements(raw) v where jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> '';
      elsif raw is not null and jsonb_typeof(raw) <> 'null' then
        raise exception 'invalid_submission' using errcode = '22023';
      end if;
      if exists (
        select 1 from unnest(picked) p
        where not (field -> 'options') ? p
      ) then
        raise exception 'invalid_submission' using errcode = '22023';
      end if;
      -- Kept in the form's option order.
      select coalesce(string_agg(o #>> '{}', ', ' order by n), '') into answer
      from jsonb_array_elements(field -> 'options') with ordinality as t(o, n)
      where (o #>> '{}') = any (picked);
    else
      if raw is not null and jsonb_typeof(raw) not in ('string', 'null') then
        raise exception 'invalid_submission' using errcode = '22023';
      end if;
      answer := btrim(coalesce(raw #>> '{}', ''));
    end if;

    if answer = '' then
      if (field ->> 'required') = 'true' then
        raise exception 'invalid_submission' using errcode = '22023';
      end if;
      continue;
    end if;

    if field_type = 'email' then
      answer := lower(answer);
      if answer !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(answer) > 254 then
        raise exception 'invalid_submission' using errcode = '22023';
      end if;
    elsif field_type = 'phone' and char_length(answer) > 40
      or field_type = 'short_text' and char_length(answer) > 200
      or field_type = 'long_text' and char_length(answer) > 2000
      or field_type = 'dropdown' and not (field -> 'options') ? answer
      or field_type = 'date' and answer !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'invalid_submission' using errcode = '22023';
    end if;
    if field_type = 'date' then
      begin
        -- A real calendar day, written back in the same form (2026-02-30 is refused).
        if to_char(answer::date, 'YYYY-MM-DD') <> answer then
          raise exception 'invalid_submission' using errcode = '22023';
        end if;
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'invalid_submission' using errcode = '22023';
      end;
    end if;

    case field_key
      when 'name' then lead_name := answer;
      when 'email' then lead_email := answer;
      when 'phone' then lead_phone := answer;
      when 'company' then lead_company := answer;
      when 'message' then lead_message := answer;
      else custom_answers := custom_answers || jsonb_build_object(
        'key', field_key, 'label', btrim(field ->> 'label'), 'value', answer);
    end case;
  end loop;

  if char_length(lead_name) not between 1 and 120 or lead_email = ''
    or char_length(lead_company) > 120
    or (form.consent_text <> '' and coalesce(payload ->> 'consent', '') <> 'true') then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;

  -- Where the visitor came from: known keys only, short text, pages over https or http.
  if jsonb_typeof(source_in) = 'object' then
    foreach attribution_key in array array['utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
      'utm_content', 'referrer', 'page_url'] loop
      answer := btrim(coalesce(source_in ->> attribution_key, ''));
      continue when answer = '';
      if attribution_key in ('referrer', 'page_url') then
        continue when answer !~ '^https?://[^\s]+$';
        answer := left(answer, 500);
      else
        answer := left(answer, 150);
      end if;
      attribution_out := attribution_out || jsonb_build_object(attribution_key, answer);
    end loop;
  end if;

  perform set_config('app.lead_form', 'on', true);
  insert into public.leads (workspace_id, name, email, phone, company_name, source, notes, form_id,
    answers, attribution)
  values (form.workspace_id, lead_name, lead_email, lead_phone, lead_company,
    left('Form: ' || form.name, 80), lead_message, form.id, custom_answers, attribution_out)
  returning id into new_lead;
  perform set_config('app.lead_form', 'off', true);

  insert into public.lead_form_submissions (workspace_id, form_id, lead_id, client_hash)
  values (form.workspace_id, form.id, new_lead, client_key);

  insert into public.activities (workspace_id, actor_id, kind, summary, href)
  values (form.workspace_id, null, 'lead',
    -- No actor: the feed shows it as from a website visitor.
    left('sent an enquiry through the form “' || form.name || '”: ' || lead_name, 300),
    '/crm/leads');

  return form.success_message;
end;
$$;

revoke execute on function public.submit_lead_form(text, jsonb, text) from public;
grant execute on function public.submit_lead_form(text, jsonb, text) to anon, authenticated;
