# Data model

Status: **no tables exist.** This maps the prototype's record shapes to the tables each phase will create. Tables are built only when their phase starts.

## Rules for every table

- A tenant-owned row has a non-null `workspace_id`, set on the server from the signed-in user's membership. It is never accepted from the client.
- Primary keys are UUIDs.
- `created_at` and `updated_at` are `timestamptz` in UTC, with `created_by` where an actor applies.
- Money is `bigint` minor units with an ISO `currency` code. No floating-point money anywhere.
- Important records are archived (`archived_at`), not deleted. Default queries exclude archived rows.
- Foreign keys always, with a deliberate `on delete` rule.
- Row-level security is enabled in the migration that creates the table.
- Workspace-scoped unique constraints where needed, such as invoice numbers.

## Phase 1: platform

| Table | Purpose | Prototype source |
| --- | --- | --- |
| `workspaces` | Name, timezone, country, default currency, default tax, payment terms | `Workspace` plus the settings in `demo-store.tsx` |
| `workspace_memberships` | User, workspace, role, status | `TeamMember` |
| `workspace_invitations` | Email, role, hashed token, expiry, accepted time | `Invitation` (has no token or expiry today) |
| `user_preferences` | Display name, job title, timezone, date format, week start, notification choices | Profile and preference settings |
| `audit_logs` | Role changes, invitation acceptance and other high-risk events | None |

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
