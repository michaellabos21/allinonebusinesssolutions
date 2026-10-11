# Security

Status: backend Phase 1. Accounts, workspaces, membership and invitations are real and protected as described below. **The business screens (contacts, projects, invoices and the rest) still run on sample data in the browser and have no access control**, because they hold no real data yet. Each gets the same treatment in its own phase. The app is not ready for real customer data.

## Principles

1. **Never trust the client.** A workspace id, user id, role, price, total, payment status or permission decision sent from the browser is ignored. The server derives each one.
2. **Enforce access twice.** Every tenant-owned table has row-level security, and every server function checks permission explicitly. Neither is a substitute for the other.
3. **Deny when unsure.** If membership or permission cannot be verified, the request fails. There are no fallbacks to a default workspace or role.
4. **Hidden buttons are not security.** The UI hides what a user cannot do; the server is what stops them.

## Tenant isolation

- The active workspace is resolved on the server from the signed-in user's own memberships (`src/server/session.ts`). A cookie records which one they last used, but it is only honoured if it matches a membership, so pointing it at another workspace does nothing.
- Server actions take the workspace id from that verified session, never from the form.
- Row-level security policies check membership through the database's own view of the user (`auth.uid()`), never a value from the request.
- `tests/integration/platform.test.ts` proves it against a real database: 25 tests in which an outsider, an ordinary member, an admin and an anonymous visitor try to read and write what they should not. Every later domain ships with the same kind of test.

## Sessions and navigation

- The request proxy (`src/proxy.ts`) refreshes the session and redirects signed-out visitors. It is a convenience. The workspace layout and every server action verify the session again, with the auth server, not from the cookie alone.
- Signing in or out, creating or joining a workspace and switching workspace all end with a full page load, so the browser cannot replay a page it cached for the previous session.
- Sign-in gives one message for a wrong email and a wrong password. Password reset gives one message whether or not the address has an account.
- The destination after sign-in (`?next=`) is restricted to same-site paths.

## Invitations

- A token is 32 random bytes. Only its SHA-256 hash is stored, so a database leak does not expose usable links.
- An invitation works once, for seven days, and only for an account whose email is the invited address. A forwarded link is useless to anyone else.
- **Email delivery is not configured.** The inviter is shown the link once and passes it on themselves. The app does not claim to have sent anything.

## Roles and permissions

Five roles exist: owner, admin, manager, member, client. What Phase 1 enforces, in `src/server/permissions.ts`, in the database functions, and in row-level security:

| Action | Owner | Admin | Manager | Member | Client |
| --- | --- | --- | --- | --- | --- |
| Change workspace settings | Yes | Yes | No | No | No |
| Invite people, cancel invitations | Yes | Yes | No | No | No |
| Change a role or remove a member | Yes | Yes, except admins | No | No | No |
| Grant or take away the admin role | Yes | No | No | No | No |
| See the member list | Yes | Yes | Yes | Yes | Yes (see note) |
| See invitations and the audit log | Yes | Yes | No | No | No |

Note: the database lets any active member read their workspace's membership rows, including a client. Restricting what clients see is Phase 5 work; no client-facing screens exist yet.

The matrix below is the **draft for later phases**. Its business-record rows are not built:

| Action | Owner | Admin | Manager | Member | Client |
| --- | --- | --- | --- | --- | --- |
| Manage billing, delete workspace | Yes | No | No | No | No |
| Manage members and roles | Yes | Yes | No | No | No |
| Change workspace settings | Yes | Yes | No | No | No |
| Create and edit contacts, companies, deals | Yes | Yes | Yes | Yes | No |
| Create and edit any project or task | Yes | Yes | Yes | Own and assigned | No |
| Issue, void or record payment on invoices | Yes | Yes | Yes | No | No |
| View financial reports | Yes | Yes | Yes | No | No |
| View records explicitly shared with them | n/a | n/a | n/a | n/a | Yes (Phase 5) |

Rules that hold whatever the matrix says: nobody can raise their own role, a workspace always has exactly one owner, and permission checks live in one module, not scattered through components.

## Secrets

- `.env.local` holds real values and is git-ignored. `.env.example` lists variable names only.
- The Supabase service-role key bypasses row-level security. It is server-only: never prefixed `NEXT_PUBLIC_`, never imported by a client component, never logged.
- Before each release, the client bundle is checked for secrets.

## Input and output

- All input is validated on the server with a schema, including input from public forms.
- Totals are computed on the server from stored lines. A total sent by the client is discarded.
- Errors shown to users never include stack traces, SQL or internal ids they do not own.

## Logging and audit

- Application logs go through `src/lib/logger.ts`: an event name and structured fields, never passwords, tokens, secrets or request bodies.
- The `audit_logs` table records workspace creation, invitations created, revoked and accepted, role changes and member removal. Invoice issue, void and payment are added in Phase 4. There is no screen for reading the log yet.

## Files (from Phase 4)

Private buckets only. Uploads are checked for size and type, stored under random keys, and served through short-lived signed URLs created after an authorisation check.

## Not claimed

This product makes no claim of tax, privacy, e-signature or other legal compliance in any country. The invoice tax options are demo rates. Local requirements must be reviewed by qualified professionals before production use.

## Before real users

The launch checklist in section 24 of the MVP plan applies in full, including rate limiting on auth and public endpoints, backup and restore, data export and deletion, and a manual review of tenant isolation.
