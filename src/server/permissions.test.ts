import { describe, expect, it } from "vitest";

import { ROLES, assignableRolesFor, can, canManageMember } from "@/server/permissions";

describe("can", () => {
  it("denies when there is no role", () => {
    expect(can(null, "members.view")).toBe(false);
    expect(can(undefined, "workspace.update_settings")).toBe(false);
  });

  it("lets only owners and admins change settings, invite, and read the audit log", () => {
    for (const action of [
      "workspace.update_settings",
      "members.invite",
      "members.change_role",
      "audit.view",
    ] as const) {
      expect(ROLES.filter((role) => can(role, action))).toEqual(["owner", "admin"]);
    }
  });

  it("lets only the owner manage admins", () => {
    expect(ROLES.filter((role) => can(role, "members.manage_admins"))).toEqual(["owner"]);
  });

  it("keeps clients out of the member list", () => {
    expect(can("client", "members.view")).toBe(false);
    expect(can("member", "members.view")).toBe(true);
  });
});

describe("assignableRolesFor", () => {
  it("never offers the owner role", () => {
    for (const role of ROLES) expect(assignableRolesFor(role)).not.toContain("owner");
  });

  it("lets the owner hand out admin, but not an admin", () => {
    expect(assignableRolesFor("owner")).toEqual(["admin", "manager", "member", "client"]);
    expect(assignableRolesFor("admin")).toEqual(["manager", "member", "client"]);
  });

  it("offers nothing to roles that cannot invite", () => {
    for (const role of ["manager", "member", "client"] as const)
      expect(assignableRolesFor(role)).toEqual([]);
  });
});

describe("canManageMember", () => {
  it("never allows acting on yourself", () => {
    for (const role of ROLES) expect(canManageMember(role, "member", true)).toBe(false);
  });

  it("never allows acting on the owner", () => {
    for (const role of ROLES) expect(canManageMember(role, "owner", false)).toBe(false);
  });

  it("lets an admin manage members and managers but not other admins", () => {
    expect(canManageMember("admin", "member", false)).toBe(true);
    expect(canManageMember("admin", "manager", false)).toBe(true);
    expect(canManageMember("admin", "admin", false)).toBe(false);
    expect(canManageMember("owner", "admin", false)).toBe(true);
  });

  it("gives managers, members and clients no authority over others", () => {
    for (const role of ["manager", "member", "client"] as const) {
      expect(canManageMember(role, "member", false)).toBe(false);
    }
  });
});
