import { describe, expect, it } from "vitest";

import {
  ROLES,
  assignableRolesFor,
  can,
  canEditTask,
  canManageMember,
  isAssignable,
} from "@/server/permissions";

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

describe("business records", () => {
  it("lets everyone but clients see and edit records", () => {
    for (const action of ["records.view", "records.edit"] as const) {
      expect(ROLES.filter((role) => can(role, action))).toEqual([
        "owner",
        "admin",
        "manager",
        "member",
      ]);
    }
  });

  it("keeps archiving, projects, the catalog, the pipeline and other people's tasks for managers and above", () => {
    for (const action of [
      "records.archive",
      "projects.manage",
      "catalog.manage",
      "tasks.edit_any",
      "pipeline.manage",
    ] as const) {
      expect(ROLES.filter((role) => can(role, action))).toEqual(["owner", "admin", "manager"]);
    }
  });

  it("lets a member edit only tasks they created or are assigned", () => {
    const task = { createdBy: "someone", assigneeId: "someone-else" };
    expect(canEditTask("member", task, "me")).toBe(false);
    expect(canEditTask("member", { ...task, createdBy: "me" }, "me")).toBe(true);
    expect(canEditTask("member", { ...task, assigneeId: "me" }, "me")).toBe(true);
    expect(canEditTask("manager", task, "me")).toBe(true);
    expect(canEditTask("client", { ...task, assigneeId: "me" }, "me")).toBe(false);
    expect(canEditTask(null, { ...task, assigneeId: "me" }, "me")).toBe(false);
  });

  it("never assigns work to a client", () => {
    expect(ROLES.filter(isAssignable)).toEqual(["owner", "admin", "manager", "member"]);
  });
});
