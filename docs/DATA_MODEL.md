# Data model

Status: the Phase 1 tables exist. Everything from Phase 2 down is still a plan: it maps the prototype's record shapes to the tables each phase will create.

## Rules for every table

- A tenant-owned row has a non-null `workspace_id`, set on the server from the signed-in user's membership. It is never accepted from the client.
- Primary keys are UUIDs.
- `created_at` and `updated_at` are `timestamptz` in UTC, with `created_by` where an actor applies.
- Money is `bigint` minor units with an ISO `currency` code. No floating-point money anywhere.
- Important records are archived (`archived_at`), not deleted. Default queries exclude archived rows.
- Foreign keys always, with a deliberate `on delete` rule.
- Row-level security is enabled in the migration that creates the table.
- Workspace-scoped unique constraints where needed, such as invoice numbers.

## Phase 1: platform (built)

Defined in `supabase/migrations/20261011000001_platform_foundation.sql`.

| Table | Holds | Notes |
| --- | --- | --- |
| `profiles` | One row per account: name, job title, timezone, date format, week start, five notification switches, and a copy of the sign-in email | Created by a trigger on sign-up. The email copy lets teammates be listed without exposing the auth schema |
| `workspaces` | Name, timezone, country, currency, default tax (basis points), payment terms | Created only through `create_workspace` |
| `workspace_memberships` | User, workspace, role, status (`active` or `removed`) | A unique index allows exactly one active owner per workspace |
| `workspace_invitations` | Email, role, SHA-256 of the token, inviter, expiry, accepted and revoked times | The token itself is never stored. One open invitation per email per workspace |
| `audit_logs` | Workspace, actor, event name, target id, short detail | Written only by database functions |

Roles are an enum: `owner`, `admin`, `manager`, `member`, `client`.

**How writes work.** There are no insert, update or delete policies on memberships, invitations or the audit log. Those tables change only through security-definer functions that re-check the caller: `create_workspace`, `set_member_role`, `remove_member`, `create_invitation`, `revoke_invitation`, `accept_invitation`. The two direct writes allowed are a user's own profile and, for owners and admins, their workspace's settings, each limited to named columns.

**Differences from the original sketch.** Preferences live on `profiles`, not a separate `user_preferences` table: they are one-to-one with the account and always read together. Notification choices are five boolean columns, not JSON.

## Phase 2: core operations

| Table | Purpose | Prototype source | Differences to resolve |
| --- | --- | --- | --- |
| `companies` | Organisations | `Company` | Add phone, address, notes |
| `contacts` | People | `Contact` | Add title, source, owner. Tags move to their own table or a validated array |
| `contact_notes` | Notes on a contact | `Note` | |
| `products_services` | Catalog | `CatalogItem` | Add optional SKU and tax category |
| `projects` | Work for a client | `Project` | |
| `project_members` | Who is on a project | Derived from task assignees today | Becomes explicit |
| `tasks` | Units of work | `Task` | Add creator. Subtasks deferred |
| `task_comments` | Updates on a task | None | New |
| `activities` | Chronological feed | `ActivityEntry` | Today the text is pre-written; store an event type and record references instead |

## Phase 3: CRM

| Table | Purpose | Prototype source | Differences to resolve |
| --- | --- | --- | --- |
| `pipelines`, `pipeline_stages` | Configurable stages with order and won/lost markers | `DEAL_STAGES`, a fixed list | Becomes data |
| `deals` | Opportunities | `Deal` | Add currency, lost reason, close date |
| `leads` | Unqualified enquiries | None | New |
| `lead_forms`, `lead_form_submissions` | Public capture forms | None | New |

## Phase 4: finance

| Table | Purpose | Prototype source | Differences to resolve |
| --- | --- | --- | --- |
| `invoices` | Header | `Invoice` | Add currency, bill-to snapshot, `partially_paid` and `void` statuses. Number allocation must be safe under concurrent requests |
| `invoice_items` | Lines | `InvoiceItem` | Add optional link to a catalog item |
| `payments` | Manual payments against an invoice | None; the prototype flips a status | New. Enables partial payments |
| `estimates`, `estimate_items` | Quotations | None | New |
| `expenses` | Spending | `Expense` | Add currency, payment method, receipt file |
| `expense_categories` | Category list | `EXPENSE_CATEGORIES`, a fixed list | Becomes data |
| `files` | Metadata for stored files | None | New; bytes live in private storage |

## Calculations that carry over unchanged

`src/lib/money.ts` already computes invoice totals in integer minor units with a single rounding step, and is covered by unit tests. Phase 4 runs the same function on the server; the client version becomes a preview only.

## Later phases

Client portal, workflow, scheduling, time, HR, AI and integration tables are listed in section 15 of the MVP plan and are not designed further here.
