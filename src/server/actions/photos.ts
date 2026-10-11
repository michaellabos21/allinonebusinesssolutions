"use server";

import { randomUUID } from "node:crypto";

import { refresh } from "next/cache";

import { logger } from "@/lib/logger";
import { PHOTO_EXTENSION, PHOTO_MAX_BYTES, isPhotoType } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { FORBIDDEN, context, explain } from "@/server/action-helpers";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";
import { idSchema } from "@/server/validation";

const BUCKET = "avatars";

const PHOTOS_UNAVAILABLE: ActionResult<never> = {
  ok: false,
  error: "Photo storage isn’t set up for this site yet, so photos can’t be added.",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Checks an uploaded file, returning an error message or null. */
function checkFile(file: FormDataEntryValue | null): string | null {
  if (!(file instanceof File)) return "Choose a photo.";
  if (!isPhotoType(file.type)) return "Use a JPEG, PNG or WebP image.";
  if (file.size === 0 || file.size > PHOTO_MAX_BYTES) return "Photos can be up to 2 MB.";
  return null;
}

/**
 * Uploads a new file, points the record at it with `link`, then removes the
 * old file. If linking fails, the new file is removed again so nothing is
 * left behind that no record points to.
 */
async function replacePhoto(
  supabase: Supabase,
  path: string,
  file: File,
  previous: string | null,
  link: (path: string | null) => PromiseLike<{ error: { code?: string; message: string } | null }>,
  event: string,
): Promise<ActionResult<undefined>> {
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) {
    if (/not found|bucket/i.test(upload.error.message)) return PHOTOS_UNAVAILABLE;
    logger.error(`${event}.upload_failed`, { message: upload.error.message });
    return { ok: false, error: "We couldn’t upload that photo. Try again." };
  }

  const { error } = await link(path);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return explain(error, `${event}.link_failed`);
  }
  if (previous) await supabase.storage.from(BUCKET).remove([previous]);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Your own profile photo
// ---------------------------------------------------------------------------

export async function uploadProfilePhotoAction(form: FormData): Promise<ActionResult<undefined>> {
  const file = form.get("file");
  const problem = checkFile(file);
  if (problem) return { ok: false, error: problem };
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has ended. Sign in again." };

  const supabase = await createClient();
  const photo = file as File;
  const userId = session.user.id;
  const path = `users/${userId}/${randomUUID()}.${PHOTO_EXTENSION[photo.type as keyof typeof PHOTO_EXTENSION]}`;
  return replacePhoto(
    supabase,
    path,
    photo,
    session.user.avatarPath,
    (next) => supabase.from("profiles").update({ avatar_path: next }).eq("id", userId),
    "profile.photo",
  );
}

export async function removeProfilePhotoAction(): Promise<ActionResult<undefined>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has ended. Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", session.user.id);
  if (error) return explain(error, "profile.photo.remove_failed");
  if (session.user.avatarPath) {
    await supabase.storage.from(BUCKET).remove([session.user.avatarPath]);
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// A contact's photo
// ---------------------------------------------------------------------------

async function findContact(
  ctx: Extract<Awaited<ReturnType<typeof context>>, { allowed: true }>,
  id: string,
) {
  const { data } = await ctx.supabase
    .from("contacts")
    .select("id, photo_path")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  return data;
}

export async function uploadContactPhotoAction(form: FormData): Promise<ActionResult<undefined>> {
  const contactId = form.get("contactId");
  const file = form.get("file");
  if (!idSchema.safeParse(contactId).success) return FORBIDDEN;
  const problem = checkFile(file);
  if (problem) return { ok: false, error: problem };
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const contact = await findContact(ctx, contactId as string);
  if (!contact) return FORBIDDEN;
  const photo = file as File;
  const path = `${ctx.workspace.id}/contacts/${contact.id}/${randomUUID()}.${PHOTO_EXTENSION[photo.type as keyof typeof PHOTO_EXTENSION]}`;
  return replacePhoto(
    ctx.supabase,
    path,
    photo,
    contact.photo_path,
    (next) =>
      ctx.supabase
        .from("contacts")
        .update({ photo_path: next })
        .eq("id", contact.id)
        .eq("workspace_id", ctx.workspace.id),
    "contact.photo",
  );
}

export async function removeContactPhotoAction(
  contactId: unknown,
): Promise<ActionResult<undefined>> {
  if (!idSchema.safeParse(contactId).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const contact = await findContact(ctx, contactId as string);
  if (!contact) return FORBIDDEN;
  const { error } = await ctx.supabase
    .from("contacts")
    .update({ photo_path: null })
    .eq("id", contact.id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return explain(error, "contact.photo.remove_failed");
  if (contact.photo_path) await ctx.supabase.storage.from(BUCKET).remove([contact.photo_path]);
  refresh();
  return { ok: true };
}
