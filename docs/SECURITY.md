# Security

Status: backend Phase 0. **The app has no authentication, no database and no server-side logic, so none of these controls exist yet.** It must not be given real customer data in its current form. This document sets the rules each phase has to meet.

## Principles

1. **Never trust the client.** A workspace id, user id, role, price, total, payment status or permission decision sent from the browser is ignored. The server derives each one.
2. **Enforce access twice.** Every tenant-owned table has row-level security, and every server function checks permission explicitly. Neither is a substitute for the other.
3. **Deny when unsure.** If membership or permission cannot be verified, the request fails. There are no fallbacks to a default workspace or role.
4. **Hidden buttons are not security.** The UI hides what a user cannot do; the server is what stops them.

## Tenant isolation

- A workspace id is resolved from the signed-in user's membership on every request.
- Row-level security policies check membership through the database's own view of the user, never a value from the request.
- Each domain ships with an automated test in which a member of Workspace A tries to read, update and delete a Workspace B record and is refused. A phase is not done without it.

## Roles and permissions (draft for Phase 1)

The prototype shows Owner, Admin and Member as labels only. The plan calls for five roles. Proposed starting matrix, to be agreed before Phase 1:

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
- From Phase 1, an `audit_logs` table records role changes, invitation acceptance, and later invoice issue, void and payment.

## Files (from Phase 4)

Private buckets only. Uploads are checked for size and type, stored under random keys, and served through short-lived signed URLs created after an authorisation check.

## Not claimed

This product makes no claim of tax, privacy, e-signature or other legal compliance in any country. The invoice tax options are demo rates. Local requirements must be reviewed by qualified professionals before production use.

## Before real users

The launch checklist in section 24 of the MVP plan applies in full, including rate limiting on auth and public endpoints, backup and restore, data export and deletion, and a manual review of tenant isolation.
