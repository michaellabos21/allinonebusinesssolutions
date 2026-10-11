-- Profile and contact photos.
--
-- Photos live in a private storage bucket, "avatars", and are served through
-- the app at /photos/<path> with the viewer's own session, so storage policies
-- decide who sees what:
--
--   users/<user id>/<random>.<ext>                     a person's profile photo
--   <workspace id>/contacts/<contact id>/<random>.<ext>  a contact's photo
--
-- A profile photo is visible to its owner and to anyone sharing a workspace
-- with them, and only its owner can change it. A contact photo is visible to,
-- and changeable by, anyone who can use that workspace's records (owners,
-- admins, managers and members; never clients).
--
-- Every statement here can run again safely, so a half-finished run in the
-- SQL Editor can simply be repeated.

-- ---------------------------------------------------------------------------
-- Where each photo is recorded
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_check;
alter table public.profiles add constraint profiles_avatar_path_check check (
  avatar_path is null
  or (avatar_path ~ '^users/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and split_part(avatar_path, '/', 2) = id::text)
);
grant update (avatar_path) on public.profiles to authenticated;

alter table public.contacts add column if not exists photo_path text;
alter table public.contacts drop constraint if exists contacts_photo_path_check;
alter table public.contacts add constraint contacts_photo_path_check check (
  photo_path is null
  or (photo_path ~ '^[0-9a-f-]{36}/contacts/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and split_part(photo_path, '/', 1) = workspace_id::text
      and split_part(photo_path, '/', 3) = id::text)
);

-- ---------------------------------------------------------------------------
-- Who may see or change a photo file, from its path alone
-- ---------------------------------------------------------------------------

create or replace function private.photo_access(object_name text, to_change boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(object_name, '/');
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  -- Checked step by step so a malformed path is refused rather than an error.
  if cardinality(parts) = 3 and parts[1] = 'users' and parts[2] ~ uuid_pattern then
    if parts[2]::uuid = (select auth.uid()) then
      return true;
    end if;
    return not to_change and private.shares_workspace_with(parts[2]::uuid);
  end if;

  if cardinality(parts) = 4 and parts[1] ~ uuid_pattern and parts[2] = 'contacts'
    and parts[3] ~ uuid_pattern then
    return private.can_use_records(parts[1]::uuid)
      and exists (
        select 1 from public.contacts c
        where c.id = parts[3]::uuid and c.workspace_id = parts[1]::uuid
      );
  end if;

  return false;
end;
$$;

revoke execute on function private.photo_access(text, boolean) from public, anon;
grant execute on function private.photo_access(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The bucket and its rules
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage is not enabled; photo uploads are unavailable.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "Teammates see photos" on storage.objects;
  drop policy if exists "People add photos" on storage.objects;
  drop policy if exists "People remove photos" on storage.objects;

  execute $policy$
    create policy "Teammates see photos" on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and private.photo_access(name, false))
  $policy$;
  execute $policy$
    create policy "People add photos" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and private.photo_access(name, true))
  $policy$;
  execute $policy$
    create policy "People remove photos" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and private.photo_access(name, true))
  $policy$;
end;
$$;
