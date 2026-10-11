import { randomUUID } from "node:crypto";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { createInvitationToken } from "@/server/invitations";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Integration tests need .env.local with the local Supabase URL and keys. Run `npx supabase start`.",
  );
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  // These tests create and delete accounts. Never point them at a shared database.
  throw new Error(`Refusing to run integration tests against a non-local database: ${url}`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses row-level security. Used only to set up and tear down fixtures. */
export const admin = createClient(url, serviceKey, options);

/** A client with no session, as an anonymous visitor would have. */
export const anonymous = () => createClient(url, anonKey, options);

export type TestUser = { id: string; email: string; client: SupabaseClient };

const PASSWORD = "integration-test-password";
const created: string[] = [];

/** Creates a confirmed account and returns a client signed in as that user. */
export async function createUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@isolation.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error || !data.user) throw new Error(`Could not create ${label}: ${error?.message}`);
  created.push(data.user.id);

  const client = createClient(url!, anonKey!, options);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`Could not sign in ${label}: ${signIn.error.message}`);
  return { id: data.user.id, email, client };
}

export async function createWorkspace(owner: TestUser, name: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_workspace", {
    workspace_name: name,
    workspace_timezone: "Asia/Manila",
    workspace_country: "PH",
    workspace_currency: "PHP",
  });
  if (error) throw new Error(`Could not create workspace: ${error.message}`);
  return data as string;
}

/** Invites `email` and returns the token hash, as the server action would compute it. */
export async function invite(
  inviter: TestUser,
  workspaceId: string,
  email: string,
  role: "admin" | "manager" | "member" | "client" = "member",
) {
  const { tokenHash } = createInvitationToken();
  const result = await inviter.client.rpc("create_invitation", {
    target_workspace: workspaceId,
    invitee_email: email,
    invitee_role: role,
    invite_token_hash: tokenHash,
    invite_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  return { tokenHash, error: result.error, invitationId: result.data as string | null };
}

/** Invites a user and has them accept, returning their membership id. */
export async function addMember(
  owner: TestUser,
  workspaceId: string,
  user: TestUser,
  role: "admin" | "manager" | "member" | "client" = "member",
) {
  const { tokenHash, error } = await invite(owner, workspaceId, user.email, role);
  if (error) throw new Error(`Could not invite: ${error.message}`);
  const accepted = await user.client.rpc("accept_invitation", { invite_token_hash: tokenHash });
  if (accepted.error) throw new Error(`Could not accept: ${accepted.error.message}`);
  const { data } = await admin
    .from("workspace_memberships")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  return data!.id as string;
}

/** Removes every account the tests created, and with them their workspaces. */
export async function cleanUp() {
  // Workspaces are owned by their creator with `on delete restrict`, so they go first.
  await admin.from("workspaces").delete().in("created_by", created);
  for (const id of created) await admin.auth.admin.deleteUser(id);
  created.length = 0;
}
