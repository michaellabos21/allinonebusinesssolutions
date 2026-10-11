import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { can, type Role } from "@/server/permissions";
import type { InvitationRow, Session, SessionWorkspace, TeamMemberRow } from "@/server/types";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";

/**
 * Who is signed in and which workspace they are working in. Returns null when
 * signed out. The active workspace comes from a cookie, but only as a
 * preference: it is used only if it matches one of the user's own memberships,
 * so setting the cookie to someone else's workspace id achieves nothing.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspace_memberships")
      .select(
        "role, workspaces (id, name, timezone, country, currency, tax_rate_bps, payment_term_days, created_at)",
      )
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);
  if (!profile) return null;

  type WorkspaceRecord = {
    id: string;
    name: string;
    timezone: string;
    country: string;
    currency: string;
    tax_rate_bps: number;
    payment_term_days: number;
    created_at: string;
  };
  const workspaces: SessionWorkspace[] = (memberships ?? [])
    .map((row) => ({
      role: row.role as Role,
      record: row.workspaces as unknown as WorkspaceRecord | null,
    }))
    .filter((row): row is { role: Role; record: WorkspaceRecord } => row.record !== null)
    .sort((a, b) => a.record.created_at.localeCompare(b.record.created_at))
    .map(({ role, record }) => ({
      id: record.id,
      name: record.name,
      timezone: record.timezone,
      country: record.country,
      currency: record.currency,
      taxRateBps: record.tax_rate_bps,
      paymentTermDays: record.payment_term_days,
      role,
    }));

  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const workspace = workspaces.find((item) => item.id === preferred) ?? workspaces[0] ?? null;

  return {
    user: {
      id: user.id,
      email: profile.email,
      fullName: profile.full_name,
      jobTitle: profile.job_title,
      timezone: profile.timezone,
      dateFormat: profile.date_format,
      weekStartsOn: profile.week_starts_on,
      notifications: {
        invoiceOverdue: profile.notify_invoice_overdue,
        paymentReceived: profile.notify_payment_received,
        taskDue: profile.notify_task_due,
        mentions: profile.notify_mentions,
        weeklySummary: profile.notify_weekly_summary,
      },
    },
    workspaces,
    workspace,
  };
});

/**
 * Why a signed-in user has no session, if that is the case. Without this, the
 * workspace pages would send them to /login, which sends signed-in users back,
 * and the browser would loop. Both causes are set-up problems on a new
 * database: the tables were never created, or the account was created before
 * they were, so it has no profile row.
 */
export type AccountProblem = "database_not_set_up" | "profile_missing";

export const getAccountProblem = cache(async (): Promise<AccountProblem | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  // PGRST205: the API has no such table. 42P01: Postgres has no such table.
  if (error?.code === "PGRST205" || error?.code === "42P01") return "database_not_set_up";
  if (!error && !data) return "profile_missing";
  return null;
});

/** Active members of a workspace. Row-level security returns nothing to non-members. */
export async function getTeam(workspaceId: string): Promise<TeamMemberRow[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("workspace_memberships")
    .select("id, user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at");
  if (!memberships?.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, job_title")
    .in(
      "id",
      memberships.map((row) => row.user_id),
    );
  const byId = new Map((profiles ?? []).map((row) => [row.id, row]));

  return memberships.map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    fullName: byId.get(row.user_id)?.full_name ?? "Unknown member",
    email: byId.get(row.user_id)?.email ?? "",
    jobTitle: byId.get(row.user_id)?.job_title ?? "",
    role: row.role as Role,
  }));
}

/** Open invitations. Only fetched for roles allowed to invite; the database refuses others anyway. */
export async function getOpenInvitations(
  workspaceId: string,
  role: Role,
): Promise<InvitationRow[]> {
  if (!can(role, "members.invite")) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role as Role,
    invitedOn: row.created_at.slice(0, 10),
    expiresOn: row.expires_at.slice(0, 10),
    expired: new Date(row.expires_at).getTime() <= now,
  }));
}
