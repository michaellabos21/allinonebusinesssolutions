"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";

import { getSiteUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  INVITATION_TTL_DAYS,
  createInvitationToken,
  hashInvitationToken,
  looksLikeInvitationToken,
} from "@/server/invitations";
import { ROLE_LABEL, assignableRolesFor, can } from "@/server/permissions";
import { ACTIVE_WORKSPACE_COOKIE, getSession } from "@/server/session";
import type { ActionResult, NavigateResult } from "@/server/types";
import { fieldErrorsOf, idSchema, inviteSchema, memberRoleSchema } from "@/server/validation";

/** Messages for the errors the database functions raise. Anything else is logged and kept generic. */
const DATABASE_ERRORS: Record<string, string> = {
  forbidden: "You don’t have permission to do that.",
  already_a_member: "This person is already a member of the workspace.",
  role_not_allowed: "You can’t assign that role.",
  cannot_change_own_role: "You can’t change your own role.",
  owner_role_is_fixed: "The owner’s role can’t be changed.",
  only_owner_manages_admins: "Only the owner can manage admins.",
  cannot_remove_this_member: "This member can’t be removed.",
  membership_not_found: "That member is no longer in the workspace.",
  invitation_not_found: "This invitation is no longer valid. Ask for a new one.",
  invitation_already_used: "This invitation has already been used.",
  invitation_expired: "This invitation has expired. Ask for a new one.",
  invitation_email_mismatch: "This invitation was sent to a different email address.",
};

function explain(message: string | undefined, event: string): string {
  const known = Object.keys(DATABASE_ERRORS).find((key) => message?.includes(key));
  if (known) return DATABASE_ERRORS[known];
  logger.error(event, { message: message ?? "unknown" });
  return "Something went wrong. Try again.";
}

async function requireWorkspace() {
  const session = await getSession();
  return session?.workspace ? { session, workspace: session.workspace } : null;
}

/**
 * Creates an invitation and returns its link. No email is sent: delivery is
 * not configured yet, so the inviter passes the link on themselves.
 */
export async function inviteMemberAction(
  input: unknown,
): Promise<ActionResult<{ link: string; email: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const context = await requireWorkspace();
  if (!context) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!can(context.workspace.role, "members.invite")) {
    return { ok: false, error: "Only an owner or admin can invite people." };
  }
  if (!assignableRolesFor(context.workspace.role).includes(parsed.data.role)) {
    return {
      ok: false,
      error: "You can’t assign that role.",
      fieldErrors: { role: "Only the owner can invite an admin." },
    };
  }

  const { token, tokenHash } = createInvitationToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invitation", {
    target_workspace: context.workspace.id,
    invitee_email: parsed.data.email,
    invitee_role: parsed.data.role,
    invite_token_hash: tokenHash,
    invite_expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) {
    if (error.code === "23505" && !error.message.includes("already_a_member")) {
      return {
        ok: false,
        error: "This person already has a pending invitation.",
        fieldErrors: {
          email: "Cancel the existing invitation first if you want to send a new link.",
        },
      };
    }
    const message = explain(error.message, "team.invite_failed");
    return {
      ok: false,
      error: message,
      fieldErrors: error.message.includes("already_a_member") ? { email: message } : undefined,
    };
  }

  const origin = (await headers()).get("origin");
  const base = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : getSiteUrl();
  refresh();
  return {
    ok: true,
    message: `Invitation created for ${parsed.data.email}`,
    data: { link: `${base}/invite/${token}`, email: parsed.data.email },
  };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(invitationId);
  const context = await requireWorkspace();
  if (!context) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!parsed.success || !can(context.workspace.role, "members.invite")) {
    return { ok: false, error: DATABASE_ERRORS.forbidden };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { target_invitation: parsed.data });
  if (error) return { ok: false, error: explain(error.message, "team.revoke_failed") };
  refresh();
  return { ok: true, message: "Invitation cancelled" };
}

export async function setMemberRoleAction(input: unknown): Promise<ActionResult> {
  const parsed = memberRoleSchema.safeParse(input);
  const context = await requireWorkspace();
  if (!context) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!parsed.success || !can(context.workspace.role, "members.change_role")) {
    return { ok: false, error: DATABASE_ERRORS.forbidden };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    target_membership: parsed.data.membershipId,
    new_role: parsed.data.role,
  });
  if (error) return { ok: false, error: explain(error.message, "team.role_change_failed") };
  refresh();
  return { ok: true, message: `Role changed to ${ROLE_LABEL[parsed.data.role].toLowerCase()}` };
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(membershipId);
  const context = await requireWorkspace();
  if (!context) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!parsed.success || !can(context.workspace.role, "members.remove")) {
    return { ok: false, error: DATABASE_ERRORS.forbidden };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { target_membership: parsed.data });
  if (error) return { ok: false, error: explain(error.message, "team.remove_failed") };
  refresh();
  return { ok: true, message: "Member removed" };
}

/** Accepts an invitation for the signed-in user, then opens that workspace. */
export async function acceptInvitationAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const token = String(formData.get("token") ?? "");
  if (!looksLikeInvitationToken(token))
    return { ok: false, error: DATABASE_ERRORS.invitation_not_found };

  const session = await getSession();
  if (!session) {
    return {
      ok: true,
      data: { redirectTo: `/login?next=${encodeURIComponent(`/invite/${token}`)}` },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    invite_token_hash: hashInvitationToken(token),
  });
  if (error || !data) return { ok: false, error: explain(error?.message, "team.accept_failed") };

  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, data as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true, data: { redirectTo: "/" } };
}
