import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createInvitationToken } from "@/server/invitations";

import {
  type TestUser,
  addMember,
  admin,
  anonymous,
  cleanUp,
  createUser,
  createWorkspace,
  invite,
} from "./helpers";

/**
 * Proves the Phase 1 access rules against a real database:
 * workspace isolation, role rules, and the invitation lifecycle.
 *
 * Cast: Ana owns workspace A. Ben owns workspace B and has nothing to do with
 * A. Mia is an ordinary member of A; Alex is an admin of A.
 */
let ana: TestUser, ben: TestUser, mia: TestUser, alex: TestUser;
let workspaceA: string, workspaceB: string;
let miaMembership: string, alexMembership: string, anaMembership: string;

beforeAll(async () => {
  [ana, ben, mia, alex] = await Promise.all([
    createUser("ana"),
    createUser("ben"),
    createUser("mia"),
    createUser("alex"),
  ]);
  workspaceA = await createWorkspace(ana, "Workspace A");
  workspaceB = await createWorkspace(ben, "Workspace B");
  miaMembership = await addMember(ana, workspaceA, mia, "member");
  alexMembership = await addMember(ana, workspaceA, alex, "admin");
  const { data } = await admin
    .from("workspace_memberships")
    .select("id")
    .eq("workspace_id", workspaceA)
    .eq("user_id", ana.id)
    .single();
  anaMembership = data!.id;
});

afterAll(cleanUp);

describe("accounts", () => {
  it("gives every new account a profile", async () => {
    const { data } = await ana.client
      .from("profiles")
      .select("full_name, email")
      .eq("id", ana.id)
      .single();
    expect(data).toEqual({ full_name: "Test ana", email: ana.email });
  });

  it("makes the creator the owner of a new workspace", async () => {
    const { data } = await ana.client
      .from("workspace_memberships")
      .select("role, status")
      .eq("workspace_id", workspaceA)
      .eq("user_id", ana.id)
      .single();
    expect(data).toEqual({ role: "owner", status: "active" });
  });
});

describe("workspace isolation", () => {
  it("hides another workspace entirely", async () => {
    const workspace = await ben.client.from("workspaces").select("id").eq("id", workspaceA);
    const members = await ben.client
      .from("workspace_memberships")
      .select("id")
      .eq("workspace_id", workspaceA);
    const invitations = await ben.client
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", workspaceA);
    const audit = await ben.client.from("audit_logs").select("id").eq("workspace_id", workspaceA);
    expect([workspace.data, members.data, invitations.data, audit.data]).toEqual([[], [], [], []]);
  });

  it("lists only the caller's own workspaces when no filter is given", async () => {
    const { data } = await ben.client.from("workspaces").select("id");
    expect(data?.map((row) => row.id)).toEqual([workspaceB]);
  });

  it("ignores an outsider's attempt to rename another workspace", async () => {
    const attempt = await ben.client
      .from("workspaces")
      .update({ name: "Taken over" })
      .eq("id", workspaceA)
      .select();
    expect(attempt.data ?? []).toEqual([]);
    const { data } = await admin.from("workspaces").select("name").eq("id", workspaceA).single();
    expect(data?.name).toBe("Workspace A");
  });

  it("refuses an outsider who tries to add themselves as a member", async () => {
    const attempt = await ben.client
      .from("workspace_memberships")
      .insert({ workspace_id: workspaceA, user_id: ben.id, role: "admin" });
    expect(attempt.error).not.toBeNull();
    const { data } = await admin
      .from("workspace_memberships")
      .select("id")
      .eq("workspace_id", workspaceA)
      .eq("user_id", ben.id);
    expect(data).toEqual([]);
  });

  it("refuses an outsider who tries to invite into, or manage members of, another workspace", async () => {
    expect((await invite(ben, workspaceA, "friend@isolation.test")).error?.message).toContain(
      "forbidden",
    );
    const role = await ben.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "admin",
    });
    expect(role.error?.message).toContain("forbidden");
    const removal = await ben.client.rpc("remove_member", { target_membership: miaMembership });
    expect(removal.error?.message).toContain("forbidden");
  });

  it("hides the profiles of people the caller shares no workspace with", async () => {
    const stranger = await ben.client.from("profiles").select("id").eq("id", ana.id);
    const teammate = await mia.client.from("profiles").select("id").eq("id", ana.id);
    expect(stranger.data).toEqual([]);
    expect(teammate.data).toEqual([{ id: ana.id }]);
  });

  it("gives an anonymous visitor nothing", async () => {
    const visitor = anonymous();
    for (const table of [
      "profiles",
      "workspaces",
      "workspace_memberships",
      "workspace_invitations",
      "audit_logs",
    ]) {
      const { data } = await visitor.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
    const attempt = await visitor.rpc("create_workspace", {
      workspace_name: "Anonymous",
      workspace_timezone: "UTC",
      workspace_country: "PH",
      workspace_currency: "PHP",
    });
    expect(attempt.error).not.toBeNull();
  });
});

describe("direct writes", () => {
  it("cannot create a workspace without going through create_workspace", async () => {
    const attempt = await ana.client
      .from("workspaces")
      .insert({ name: "Side door", created_by: ana.id });
    expect(attempt.error).not.toBeNull();
  });

  it("cannot rewrite who created a workspace", async () => {
    const attempt = await ana.client
      .from("workspaces")
      .update({ created_by: ben.id })
      .eq("id", workspaceA);
    expect(attempt.error).not.toBeNull();
  });

  it("cannot change another person's profile, or one's own email copy", async () => {
    const other = await ana.client
      .from("profiles")
      .update({ full_name: "Renamed" })
      .eq("id", mia.id)
      .select();
    expect(other.data ?? []).toEqual([]);
    const ownEmail = await ana.client
      .from("profiles")
      .update({ email: "spoof@isolation.test" })
      .eq("id", ana.id);
    expect(ownEmail.error).not.toBeNull();
  });

  it("cannot change a membership row directly, even one's own", async () => {
    const attempt = await mia.client
      .from("workspace_memberships")
      .update({ role: "owner" })
      .eq("id", miaMembership)
      .select();
    expect(attempt.error ?? attempt.data).not.toEqual([expect.anything()]);
    const { data } = await admin
      .from("workspace_memberships")
      .select("role")
      .eq("id", miaMembership)
      .single();
    expect(data?.role).toBe("member");
  });

  it("cannot write to the audit log", async () => {
    const attempt = await ana.client
      .from("audit_logs")
      .insert({ workspace_id: workspaceA, event: "member.role_changed" });
    expect(attempt.error).not.toBeNull();
  });
});

describe("roles", () => {
  it("lets a member read the team but not settings, invitations or the audit log", async () => {
    const team = await mia.client
      .from("workspace_memberships")
      .select("id")
      .eq("workspace_id", workspaceA);
    expect(team.data?.length).toBe(3);

    const rename = await mia.client
      .from("workspaces")
      .update({ name: "Mia's" })
      .eq("id", workspaceA)
      .select();
    expect(rename.data ?? []).toEqual([]);
    const invitations = await mia.client
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", workspaceA);
    const audit = await mia.client.from("audit_logs").select("id").eq("workspace_id", workspaceA);
    expect([invitations.data, audit.data]).toEqual([[], []]);
    expect((await invite(mia, workspaceA, "someone@isolation.test")).error?.message).toContain(
      "forbidden",
    );
  });

  it("stops anyone raising their own role", async () => {
    const member = await mia.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "admin",
    });
    expect(member.error?.message).toContain("forbidden");
    const adminSelf = await alex.client.rpc("set_member_role", {
      target_membership: alexMembership,
      new_role: "manager",
    });
    expect(adminSelf.error?.message).toContain("cannot_change_own_role");
  });

  it("keeps the owner role fixed", async () => {
    const demote = await alex.client.rpc("set_member_role", {
      target_membership: anaMembership,
      new_role: "member",
    });
    expect(demote.error?.message).toContain("owner_role_is_fixed");
    const promote = await ana.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "owner",
    });
    expect(promote.error?.message).toContain("owner_role_is_fixed");
    const remove = await alex.client.rpc("remove_member", { target_membership: anaMembership });
    expect(remove.error?.message).toContain("cannot_remove_this_member");
  });

  it("lets only the owner hand out the admin role", async () => {
    const byAdmin = await alex.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "admin",
    });
    expect(byAdmin.error?.message).toContain("only_owner_manages_admins");
    expect(
      (await invite(alex, workspaceA, "new-admin@isolation.test", "admin")).error?.message,
    ).toContain("role_not_allowed");
  });

  it("lets an admin change a member's role, and records it", async () => {
    const change = await alex.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "manager",
    });
    expect(change.error).toBeNull();
    const { data } = await ana.client
      .from("audit_logs")
      .select("event, detail, actor_id")
      .eq("workspace_id", workspaceA)
      .eq("event", "member.role_changed")
      .eq("target_id", miaMembership);
    expect(data).toEqual([
      { event: "member.role_changed", detail: "member -> manager", actor_id: alex.id },
    ]);

    await ana.client.rpc("set_member_role", {
      target_membership: miaMembership,
      new_role: "member",
    });
  });

  it("lets an admin change workspace settings, within the allowed values", async () => {
    const ok = await alex.client
      .from("workspaces")
      .update({ payment_term_days: 30 })
      .eq("id", workspaceA)
      .select("id");
    expect(ok.data).toEqual([{ id: workspaceA }]);
    const bad = await alex.client
      .from("workspaces")
      .update({ payment_term_days: 400 })
      .eq("id", workspaceA);
    expect(bad.error).not.toBeNull();
  });
});

describe("invitations", () => {
  it("shows a visitor with the link only the workspace name, address, role and state", async () => {
    const guest = await createUser("guest");
    const { tokenHash } = await invite(ana, workspaceA, guest.email);
    const { data } = await anonymous().rpc("get_invitation_preview", {
      invite_token_hash: tokenHash,
    });
    expect(data).toEqual([
      { workspace_name: "Workspace A", email: guest.email, role: "member", state: "pending" },
    ]);

    const unknown = await anonymous().rpc("get_invitation_preview", {
      invite_token_hash: createInvitationToken().tokenHash,
    });
    expect(unknown.data).toEqual([]);
  });

  it("can only be accepted by the invited address, and only once", async () => {
    const invitee = await createUser("invitee");
    const { tokenHash } = await invite(ana, workspaceA, invitee.email);

    const wrongPerson = await ben.client.rpc("accept_invitation", { invite_token_hash: tokenHash });
    expect(wrongPerson.error?.message).toContain("invitation_email_mismatch");

    const accepted = await invitee.client.rpc("accept_invitation", {
      invite_token_hash: tokenHash,
    });
    expect(accepted.data).toBe(workspaceA);
    const visible = await invitee.client.from("workspaces").select("id").eq("id", workspaceA);
    expect(visible.data).toEqual([{ id: workspaceA }]);

    const again = await invitee.client.rpc("accept_invitation", { invite_token_hash: tokenHash });
    expect(again.error?.message).toContain("invitation_already_used");

    const { data: log } = await ana.client
      .from("audit_logs")
      .select("actor_id")
      .eq("workspace_id", workspaceA)
      .eq("event", "invitation.accepted")
      .eq("actor_id", invitee.id);
    expect(log).toHaveLength(1);
  });

  it("stops working once expired or revoked", async () => {
    const late = await createUser("late");
    const expired = createInvitationToken();
    // An expired invitation cannot be created through the API, so the fixture is written directly.
    await admin.from("workspace_invitations").insert({
      workspace_id: workspaceA,
      email: late.email,
      role: "member",
      token_hash: expired.tokenHash,
      invited_by: ana.id,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const attempt = await late.client.rpc("accept_invitation", {
      invite_token_hash: expired.tokenHash,
    });
    expect(attempt.error?.message).toContain("invitation_expired");

    const cancelled = await createUser("cancelled");
    const { tokenHash, invitationId } = await invite(ana, workspaceA, cancelled.email);
    expect(
      (await ana.client.rpc("revoke_invitation", { target_invitation: invitationId })).error,
    ).toBeNull();
    const afterRevoke = await cancelled.client.rpc("accept_invitation", {
      invite_token_hash: tokenHash,
    });
    expect(afterRevoke.error?.message).toContain("invitation_not_found");
  });

  it("rejects a second open invitation, an existing member, and an owner invitation", async () => {
    const email = `dup-${randomUUID().slice(0, 8)}@isolation.test`;
    expect((await invite(ana, workspaceA, email)).error).toBeNull();
    expect((await invite(ana, workspaceA, email)).error).not.toBeNull();
    expect((await invite(ana, workspaceA, mia.email)).error?.message).toContain("already_a_member");
    // "owner" is not an assignable role; the helper's type forbids it, so call the function directly.
    const asOwner = await ana.client.rpc("create_invitation", {
      target_workspace: workspaceA,
      invitee_email: `owner-${randomUUID().slice(0, 8)}@isolation.test`,
      invitee_role: "owner",
      invite_token_hash: createInvitationToken().tokenHash,
      invite_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(asOwner.error?.message).toContain("role_not_allowed");
  });
});

describe("removal", () => {
  it("cuts off a removed member immediately", async () => {
    const leaver = await createUser("leaver");
    const membership = await addMember(ana, workspaceA, leaver);
    expect(
      (await leaver.client.from("workspaces").select("id").eq("id", workspaceA)).data,
    ).toHaveLength(1);

    expect(
      (await ana.client.rpc("remove_member", { target_membership: membership })).error,
    ).toBeNull();
    expect((await leaver.client.from("workspaces").select("id").eq("id", workspaceA)).data).toEqual(
      [],
    );
    expect(
      (
        await leaver.client
          .from("workspace_memberships")
          .select("id")
          .eq("workspace_id", workspaceA)
      ).data,
    ).toEqual([]);
  });
});
