/**
 * The one place that says which role may do what.
 *
 * Server actions call `can()` before touching the database, and the database
 * enforces the same rules again in its own functions and policies. UI code may
 * call `can()` to hide controls, but hiding a button is never the protection.
 */
export const ROLES = ["owner", "admin", "manager", "member", "client"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  client: "Client",
};

export type Action =
  | "workspace.update_settings"
  | "members.view"
  | "members.invite"
  | "members.change_role"
  | "members.remove"
  | "members.manage_admins"
  | "audit.view"
  /** See contacts, companies, the catalog, projects, tasks and the activity feed. */
  | "records.view"
  /** Add and edit contacts, companies, notes and tasks. */
  | "records.edit"
  /** Archive and restore contacts, companies and catalog items. */
  | "records.archive"
  /** Create and edit projects. */
  | "projects.manage"
  /** Add and edit catalog items and prices. */
  | "catalog.manage"
  /** Edit any task, not only one's own. */
  | "tasks.edit_any"
  /** Add, rename, reorder and archive pipeline stages; create and change lead forms. */
  | "pipeline.manage";

const MATRIX: Record<Action, readonly Role[]> = {
  "workspace.update_settings": ["owner", "admin"],
  "members.view": ["owner", "admin", "manager", "member"],
  "members.invite": ["owner", "admin"],
  "members.change_role": ["owner", "admin"],
  "members.remove": ["owner", "admin"],
  "members.manage_admins": ["owner"],
  "audit.view": ["owner", "admin"],
  "records.view": ["owner", "admin", "manager", "member"],
  "records.edit": ["owner", "admin", "manager", "member"],
  "records.archive": ["owner", "admin", "manager"],
  "projects.manage": ["owner", "admin", "manager"],
  "catalog.manage": ["owner", "admin", "manager"],
  "pipeline.manage": ["owner", "admin", "manager"],
  "tasks.edit_any": ["owner", "admin", "manager"],
};

/** False for an unknown or missing role: when in doubt, deny. */
export function can(role: Role | null | undefined, action: Action): boolean {
  return role ? MATRIX[action].includes(role) : false;
}

/** Roles that can be handed out by invitation or role change. Owner is never one of them. */
export const ASSIGNABLE_ROLES = [
  "admin",
  "manager",
  "member",
  "client",
] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Which roles this actor may give to someone else. */
export function assignableRolesFor(actor: Role | null | undefined): AssignableRole[] {
  if (!can(actor, "members.invite")) return [];
  return ASSIGNABLE_ROLES.filter((role) => role !== "admin" || can(actor, "members.manage_admins"));
}

/**
 * Whether `actor` may change or remove a member who currently has `target` role.
 * Nobody acts on themselves or on the owner, and only the owner manages admins.
 */
export function canManageMember(
  actor: Role | null | undefined,
  target: Role,
  isSelf: boolean,
): boolean {
  if (isSelf || target === "owner") return false;
  if (!can(actor, "members.change_role")) return false;
  return target !== "admin" || can(actor, "members.manage_admins");
}

/** Whether work can be assigned to someone with this role. Clients are outside the team. */
export function isAssignable(role: Role): boolean {
  return role !== "client";
}

/** A member may edit a task they created or are assigned; managers and above edit any. */
export function canEditTask(
  role: Role | null | undefined,
  task: { createdBy: string | null; assigneeId: string },
  userId: string,
): boolean {
  if (can(role, "tasks.edit_any")) return true;
  return can(role, "records.edit") && (task.createdBy === userId || task.assigneeId === userId);
}
