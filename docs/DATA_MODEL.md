# Data model

Status: the Phase 1, 2 and 3 tables exist. Everything from Phase 4 down is still a plan: it maps the prototype's record shapes to the tables each phase will create.

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
Built in `supabase/migrations/20261011000003_sales_pipeline.sql`.

| Table | Holds | Notes |
| --- | --- | --- |
| `pipeline_stages` | Name, position, kind (`open`, `won`, `lost`), archived time | One pipeline per workspace, seeded with six stages. A deferred trigger keeps at least one live stage of each kind |
| `deals` | Name, company, contact, owner, stage, `amount_minor` and `currency`, expected close, close date, lost reason, source lead | The close date and lost reason follow the stage, set by a trigger |
| `leads` | Name, email, phone, company name, source, status, notes, owner, form, conversion links and time | `converted` only through `convert_lead`; a converted lead's outcome can't change |
| `lead_forms` | Name, unguessable token, introduction, consent text, thank-you message, active | The token can't be changed |
| `lead_form_submissions` | Form, lead, hashed visitor key, time | For rate limits and provenance; never public |

`activities` gains `lead` and `deal` kinds and a `deal_id`, which gives each deal its history. Functions: `set_stage_order`, `convert_lead` (both run as the caller), `get_lead_form` and `submit_lead_form` (the only two the public can call).

## Phase 4: finance

Built in `supabase/migrations/20261011000004_finance.sql`. Money is `bigint` minor units with an ISO `currency`; quantities are `quantity_milli` (thousandths of a unit).

| Table | Holds | Notes |
| --- | --- | --- |
| `document_counters` | Next invoice and estimate number per workspace | Taken under a row lock by `private.take_document_number`, so concurrent issues never share a number |
| `estimates`, `estimate_items` | Client, dates, discount, tax rate, notes, stored totals, status (`draft`, `sent`, `accepted`, `declined`), converted invoice | Number set when sent. "Expired" is derived from `valid_until` |
| `invoices`, `invoice_items` | Client, `bill_to` snapshot, dates, discount, tax rate, notes, stored totals, `paid_minor`, status (`draft`, `sent`, `partially_paid`, `paid`, `void`), void reason, source estimate | A draft has no number and an issued invoice always has one (check constraint). "Overdue" is derived. Lines may link to a catalog item in the same workspace. A line's `description` holds its name on the first line and any details after it (`src/lib/document-lines.ts`) |
| `payments` | Invoice, amount, date, method, reference, note, who recorded it | Never more than the balance; no update or delete |
| `expenses` | Date, vendor, category, description, amount, currency, payment method, notes, project, receipt path, archived time | Receipt path must start with the workspace and expense ids |

`workspaces` gains `invoice_prefix` and `estimate_prefix`. Users can only read the finance tables except `expenses`; every change goes through security-definer functions that check the role, work out the totals and enforce the status rules: `save_invoice_draft`, `delete_invoice_draft`, `issue_invoice`, `record_payment`, `void_invoice`, `save_estimate_draft`, `delete_estimate_draft`, `send_estimate`, `decide_estimate`, `convert_estimate_to_invoice`. Receipts live in the private `receipts` storage bucket.

Expense categories stay a fixed list in code (`EXPENSE_CATEGORIES`) with free text allowed; a separate table was not needed.

## Calculations

`src/lib/money.ts` and the database functions use the same rules: each line rounded once, half up; discount clamped to the subtotal; tax on what remains, rounded once, half up. `tests/integration/finance.test.ts` checks that both give the same totals.

## Later phases

Client portal, workflow, scheduling, time, HR, AI and integration tables are listed in section 15 of the MVP plan and are not designed further here.
