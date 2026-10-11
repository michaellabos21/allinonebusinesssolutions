# Agiled-Inspired Business OS — Phased MVP Build Plan

**Purpose:** A Claude Code implementation brief for building an original, modular, multi-tenant business-management SaaS inspired by the *category* of products like Agiled. This is a product plan, not a request to copy Agiled's branding, proprietary UI, code, or exact wording.

**Product principle:** Ship a reliable small-business operating system in phases. The first release should make one customer's daily work easier; advanced modules must not delay the core workflow.

---

## 1. Product vision

Build a web app where a small business can manage its customers, sales opportunities, projects, tasks, services, invoices, and team from one workspace. Later releases can add client portals, automation, scheduling, time tracking, HR, AI assistance, integrations, and commerce.

### Target users

Start with small service businesses, freelancers, consultants, and agencies. Design the data model to support other small businesses later, including Filipino MSMEs, without hard-coding one industry's workflow into the core product.

### Core user promise

> Track a customer from first inquiry to completed work and payment without having to maintain disconnected spreadsheets and apps.

### Product principles

1. **Multi-tenant from day one:** every business has a workspace, and tenant boundaries are enforced on the server and database.
2. **One source of truth:** CRM, projects, files, and invoices link to the same customer records.
3. **Modular navigation:** users see enabled modules, but all modules share a consistent design system.
4. **Trustworthy over flashy:** correct permissions, data validation, auditability, and clear error states take priority over animations.
5. **Build real workflows:** buttons must work, saved data must persist, and lists must be backed by real database queries. Do not ship decorative or fake interactions.
6. **Progressive complexity:** keep Phase 1 simple; add only the features needed to complete the phase's acceptance criteria.
7. **Original implementation:** use familiar SaaS interaction patterns, but create original branding, copy, and visual styling.

---

## 2. Recommended implementation stack

Use this as the default unless the existing repository already has a working stack. Inspect the repository before changing dependencies or conventions.

- **Framework:** Next.js App Router + React + TypeScript, strict mode.
- **Styling:** Tailwind CSS and a consistent component library such as shadcn/ui.
- **Database:** PostgreSQL through Supabase.
- **Authentication:** Supabase Auth.
- **Database access:** use generated types and a clear server-side data-access layer; use SQL migrations as the source of truth. Choose either a consistent Supabase client approach or an ORM if the repository already uses one; do not mix approaches casually.
- **Validation:** Zod schemas shared where appropriate between forms and server actions/API handlers.
- **Forms:** React Hook Form where forms are substantial; native controlled forms are fine for small cases.
- **Files:** Supabase Storage with private buckets and signed URLs for protected files.
- **Testing:** Vitest or the repo's existing unit-test framework, plus Playwright for critical end-to-end flows.
- **Deployment target:** Vercel or another Next.js-compatible host, with Supabase as the managed database/auth/storage layer.
- **Observability:** structured server logs and an error-monitoring adapter added when deployment requires it.

### Technical constraints

- Do not expose service-role keys or other secrets to the browser.
- Never trust a client-supplied `workspace_id`, `user_id`, role, price, payment status, or permission decision. Verify it on the server.
- Enable PostgreSQL Row Level Security (RLS) for tenant-owned tables and test policies. Server-side authorization must also be explicit.
- Use UTC for stored timestamps; display them in the user's configured timezone.
- Store money as integer minor units (for example, centavos) plus ISO currency code; do not use floating-point math for totals.
- Use database transactions for multi-record operations that must succeed or fail together.
- Add pagination, search, sorting, and empty/loading/error states for data-heavy screens.
- Keep modules separated by domain. Avoid one giant page or one generic service file for the entire application.
- Don't add AI, billing, webhooks, or payment processing until their assigned phase.

---

## 3. Scope and release strategy

### Phase overview

| Phase | Release goal | Main outcome |
|---|---|---|
| 0 | Repository and product foundation | A documented, testable project structure |
| 1 | Secure SaaS foundation | Signup, login, workspace, members, settings, dashboard shell |
| 2 | Core operations | Customers, services/products, projects, tasks, activity history |
| 3 | CRM and sales | Leads, deals, customizable pipeline stages, lead forms |
| 4 | Basic finance | Estimates, invoices, expenses, payment recording, PDF output |
| 5 | Client-facing workflow | Client portal, document sharing, proposal/approval workflow |
| 6 | Automation and notifications | Rules-based triggers/actions and notification center |
| 7 | Scheduling and time | Bookings, availability, tracked time, billable time |
| 8 | Team operations | HR basics, knowledge base, lightweight team discussions |
| 9 | AI assistant and controlled agents | Context-aware drafting/summaries with guarded actions |
| 10 | Advanced growth | Integrations, API/webhooks, commerce, analytics, mobile polish |

**Important:** Finish and verify each phase before beginning the next. The first useful paid beta is expected to be after Phase 4 or Phase 5, not after Phase 10.

---

## 4. Phase 0 — Inspect and establish the foundation

### Goal

Understand the existing codebase and establish clear development conventions without unnecessary rewrites.

### Tasks

1. Inspect the repository, package scripts, framework version, current routes, database setup, and existing tests.
2. If it is an empty repo, initialize the stack in Section 2.
3. Create or update:
   - `README.md` with setup and run instructions
   - `.env.example` with variable names only, never real credentials
   - `docs/ARCHITECTURE.md`
   - `docs/PRODUCT_ROADMAP.md`
   - `docs/DATA_MODEL.md`
   - `docs/SECURITY.md`
   - a migration workflow and seed-data workflow
4. Set linting, formatting, TypeScript strict checks, and test commands.
5. Add an app-wide error boundary, not-found page, and consistent logging approach.
6. Add CI checks for lint, typecheck, unit tests, and build if CI exists or is easy to set up.

### Acceptance criteria

- A new developer can set up the application using the README.
- Environment variables are documented without secrets.
- Lint, typecheck, tests, and production build run successfully.
- Architecture decisions and planned phase boundaries are documented.
- No product module has been implemented prematurely just to make the dashboard look full.

---

## 5. Phase 1 — Secure SaaS foundation

### Goal

A user can create an account, create or join a business workspace, and access a secure workspace shell.

### Features

**Authentication**
- Sign up, sign in, sign out, password reset, and protected routes.
- Email verification if supported by the selected auth configuration.
- Clear loading, invalid-input, expired-session, and error states.

**Workspaces and membership**
- Create a workspace with name, timezone, country, and default currency.
- A user may belong to more than one workspace in the data model, even if initial UI only needs one.
- Workspace switcher when the user belongs to multiple workspaces.
- Invite a teammate by email; invitation expiry and acceptance flow.
- Initial roles: `owner`, `admin`, `manager`, `member`, `client`.
- Central permission helpers; no authorization rules scattered as ad hoc UI checks.

**App shell**
- Responsive sidebar/top navigation.
- Workspace profile and settings.
- Profile preferences: name, avatar, timezone.
- Team member list, invitation state, and role management for authorized users.
- Dashboard shell with genuinely useful onboarding checklist and empty states.
- Module navigation can show “Coming in a later phase” only when clearly labeled; do not show fake data as live metrics.

**Security foundation**
- Enforce workspace access server-side and with RLS.
- Prevent unauthorized members from reading or modifying another workspace's data.
- Prevent users from elevating their own role.
- Log high-risk events such as role changes and invitation acceptance.

### Suggested routes

- `/login`
- `/signup`
- `/forgot-password`
- `/app`
- `/app/settings/workspace`
- `/app/settings/profile`
- `/app/settings/team`

### Acceptance criteria

- A user can sign up, sign in, sign out, and reset their password.
- A workspace owner can invite a teammate, and the invited user can accept.
- Permissions are enforced by server-side checks and database policies, not only by hidden buttons.
- Automated tests prove that Workspace A cannot read or modify Workspace B's records.
- No secrets appear in client bundles or committed files.

---

## 6. Phase 2 — Core operations (first usable internal MVP)

### Goal

A small business can maintain customers, define its services/products, and organize work through projects and tasks.

### 6.1 Contacts and companies

- Contact CRUD (create, read, update, archive; hard deletion restricted to appropriate cases).
- Fields: name, email, phone, company, role/title, tags, source, notes, owner/assignee.
- Company/account records with name, website, phone, address, and notes.
- Link contacts to companies and related projects.
- Search, sort, filters, pagination, and duplicate-warning checks.
- Import CSV with column mapping, validation preview, and row-level error report. Import should be staged before writing records.

### 6.2 Products and services

- CRUD for catalog items.
- Fields: name, description, SKU/code (optional), item type, unit price, currency, active/archive state, optional tax category.
- Use the catalog as a source for estimates and invoices in Phase 4.
- Do not imply stock control is complete in this phase; inventory quantities belong in a future commerce/inventory scope unless explicitly needed.

### 6.3 Projects and tasks

- Create a project linked to a customer/company and optional project owner.
- Project fields: name, description, status, start date, due date, client link, members.
- Task fields: title, description, status, priority, due date, assignee, project, creator.
- Subtasks may be deferred until core tasks are stable.
- Initial views: table/list and a simple Kanban board.
- Task comments/updates and activity records for important changes.
- Project and task templates are deferred until real usage validates the need.

### 6.4 Cross-module search and activity

- Search contacts, companies, projects, and tasks within the active workspace.
- Show a chronological activity feed for important events, such as customer creation, project changes, and task completion.
- Every activity entry is tenant-scoped and has an actor when applicable.

### Suggested routes

- `/app/contacts`
- `/app/contacts/new`
- `/app/contacts/[contactId]`
- `/app/companies`
- `/app/products-services`
- `/app/projects`
- `/app/projects/[projectId]`
- `/app/tasks`
- `/app/activity`

### Acceptance criteria

- CRUD flows persist to PostgreSQL and validate input on the server.
- All lists support loading, empty, error, and pagination states.
- Archived records are excluded from default lists but can be viewed or restored by authorized users.
- Related records use database foreign keys and sensible delete/archive behavior.
- CSV import previews validation errors and never silently drops invalid rows.
- Integration tests cover cross-workspace access for each domain.

---

## 7. Phase 3 — CRM and sales pipeline

### Goal

A business can manage prospects and opportunities from first inquiry to won/lost outcome.

### Features

- Lead records with name, contact data, source, status, notes, assigned owner, and created date.
- Convert a lead into a contact/company and optionally a deal without duplicating records.
- Deal records with title, linked contact/company, amount, currency, expected close date, owner, and stage.
- Configurable pipeline stages within each workspace, including stage order and won/lost stage markers.
- Pipeline Kanban view with accessible drag-and-drop and a keyboard-accessible alternative.
- Deal history/activity timeline when amount, owner, or stage changes.
- Lost reason and close date for lost deals.
- Lead and deal filters, saved views if straightforward, and CSV export.
- Public lead capture form with spam protection/rate limiting, field validation, consent text configurable by the business, and workspace assignment.
- New form submission creates a lead and activity log entry.

### Not in scope yet

- AI lead scoring.
- Bulk marketing email campaigns.
- Sophisticated multi-touch attribution.
- Unbounded custom CRM objects.

### Acceptance criteria

- A lead can progress through a real pipeline and become a deal.
- Conversion does not create duplicate contacts when a matching record is selected.
- Stage changes are authorized and logged.
- Public forms cannot expose internal customer records or accept arbitrary workspace IDs.
- Deal amounts are stored in minor units with an ISO currency code.

---

## 8. Phase 4 — Basic finance and first beta release

### Goal

A business can prepare estimates, issue invoices, record expenses and payments, and see outstanding balances. This phase should be sufficient for a limited beta if the earlier phases are secure.

### 8.1 Estimates and invoices

- Create estimate/quotation from a customer and catalog items.
- Line items support description, quantity, unit price, line discount if enabled, and tax configuration.
- Calculate totals on the server using integer minor units or a decimal-safe library.
- Estimate statuses: `draft`, `sent`, `accepted`, `declined`, `expired`.
- Invoice statuses: `draft`, `sent`, `partially_paid`, `paid`, `overdue`, `void`.
- Workspace-configured document number prefix and sequential number allocation safe under concurrent requests.
- Due date, issue date, payment terms, bill-to information, notes, and currency.
- Generate a print-ready PDF or reliable browser print layout.
- Send by email only when email delivery is configured; show a useful setup/error state otherwise.
- Track sent/opened status only if a reliable method is implemented; do not fake delivery or open tracking.

### 8.2 Payment recording

- Record manual payments against an invoice with amount, date, method, reference, and note.
- Support partial payments and automatically recalculate outstanding balance in a transaction.
- Reconcile overpayment behavior explicitly; reject unsupported overpayments or store them as a clearly modeled customer credit.
- Do not store payment-card details.
- Online payment provider integration belongs in a separate subtask with signed webhook verification and idempotency.

### 8.3 Expenses

- Expense record with date, vendor, category, description, amount, currency, payment method, receipt file, and notes.
- Private receipt storage with authorized access only.
- Basic expense list, filters, and monthly totals.

### 8.4 Finance overview

- Total invoiced, collected, outstanding, and expense totals for a chosen date range.
- Define each metric clearly and test it against fixture data.
- Do not label these figures as statutory accounting reports or profit unless revenue-recognition and cost rules are defined.

### Acceptance criteria

- Invoice calculations are deterministic and covered by unit tests (quantities, discounts, taxes, partial payments, rounding, and voids).
- Invoice numbering does not duplicate under concurrent requests.
- PDFs match the stored invoice totals.
- Only authorized users can issue, void, or record payments.
- Payment webhooks, if enabled, are signature-verified and idempotent.
- Reports reconcile against invoice, payment, and expense records.
- Add a clear disclaimer in configuration/docs that local statutory and tax compliance must be validated before production use in a particular country.

---

## 9. Phase 5 — Client portal and document workflow

### Goal

Clients can access only the information explicitly shared with them, while the business handles onboarding and approvals.

### Features

- Client user account linked to a specific customer/company and workspace.
- Portal dashboard containing shared projects, invoices, files, tickets (if enabled), and documents.
- Explicit sharing controls; no client access by guessing record URLs.
- Proposal/statement-of-work document template and status tracking.
- Client approval/decline action with timestamp and actor.
- File upload/download through private storage and short-lived signed URLs.
- Portal branding such as logo and primary color where practical.
- Notification when a client approves a proposal or makes a permitted update.
- Client access can be revoked without deleting business records.

### Signature handling

For the first version, implement approval/acceptance records. Treat legally meaningful electronic signatures as a separate integration and legal-review task. Do not label a typed name or checkbox as legally compliant e-signature without validating the requirements of the target jurisdiction and the chosen provider.

### Acceptance criteria

- A client belonging to Customer A cannot access Customer B's project, file, invoice, or document.
- Sharing is explicit and reversible.
- Signed URLs expire and are created only after authorization.
- Client actions are logged with timestamps and relevant record IDs.

---

## 10. Phase 6 — Notifications and workflow automation

### Goal

Automate frequent, deterministic handoffs after core records are reliable.

### Notification center

- In-app notifications with read/unread state.
- Email notification adapter for supported events.
- Per-user notification preferences for non-critical events.
- Retry failed delivery with limits and visible failure logs.

### First automation engine

Implement a deliberately small, auditable workflow model:

- **Triggers:** lead created, deal stage changed, task assigned, task due soon, invoice issued, invoice overdue, proposal approved.
- **Conditions:** simple equality/contains checks on approved fields.
- **Actions:** create task, assign task, send notification/email, update an allowed field, append activity entry.
- Enable/disable workflow, last-run status, execution history, error details, and retry policy.
- Background job/queue approach should fit the deployment host; document limitations if using a database-backed queue.
- Use idempotency keys so retries do not create duplicate tasks or duplicate external effects.
- Validate workflow definitions at save time and at execution time.
- Prevent infinite loops with execution limits, loop detection/guardrails, and maximum actions per run.
- Restrict actions by the creator's permission and workspace scope.

### Acceptance criteria

- Workflow runs are inspectable and tenant-scoped.
- A failed action does not silently appear successful.
- Retry behavior does not create duplicate invoices, tasks, or messages.
- Workflows cannot grant permissions or bypass standard authorization.

---

## 11. Phase 7 — Scheduling and time tracking

### Scheduling

- Appointment types with duration, description, location/meeting link, and host.
- Weekly availability and date-specific exceptions.
- Public booking page with timezone-aware slot display.
- Booking confirmation, cancellation, and rescheduling rules.
- Prevent double-booking using a reliable server-side conflict check and database-safe reservation strategy.
- Email notifications when configured; calendar integration can be added after internal booking works.

### Time tracking

- Manual time entries associated with a task/project and user.
- Optional timer with server-validated start/stop records; guard against multiple active timers if that is the chosen rule.
- Billable/non-billable flag, note, date, duration, approval status.
- Timesheet review and approval for managers.
- Convert approved billable time into draft invoice lines without duplicating it.

### Acceptance criteria

- Booking conflicts are prevented under concurrent attempts.
- Time records are auditable and cannot be edited by unauthorized users.
- Invoice conversion preserves a link to source time entries and is idempotent.

---

## 12. Phase 8 — Team operations

This phase should be scheduled only after beta users show a real need.

### HR basics

- Employee profile and employment metadata appropriate to the target market.
- Leave requests and approvals.
- Holiday calendar.
- Attendance records only if the business rules are clear.
- Permission-restricted HR records.
- Exportable records and edit history for sensitive fields.

**Explicit exclusions for first HR release:** full payroll calculations, automatic statutory deductions, legal compliance claims, biometric attendance, and employee surveillance. These require separate requirements, jurisdiction-specific validation, and privacy review.

### Knowledge base

- Workspace articles with title, body, category, author, status, and update time.
- Draft/published visibility.
- Search and category browsing.
- Permission controls on internal articles.

### Lightweight team discussions

- Project/task comments and mentions first.
- Optional workspace channels only if customer feedback supports them.
- Avoid building a full real-time chat replacement early; integrating an existing chat tool may be better.

### Acceptance criteria

- HR data is visible only to explicitly authorized roles.
- Knowledge articles respect workspace and publication permissions.
- Edits to sensitive records are logged.

---

## 13. Phase 9 — AI assistant and controlled agents

### Goal

Use AI to reduce busywork without granting an unconstrained agent access to every workspace operation.

### Begin with assistive AI

- Draft an email based on a selected customer/deal.
- Summarize a customer, project, or deal using records the user can already access.
- Draft a proposal from selected, confirmed details.
- Summarize task/project status and suggest next steps.
- Make AI output clearly identifiable and editable before use.

### Add tool-using agents only after audit and permission systems are mature

- Define a narrow allowlist of tools, such as `create_task`, `draft_email`, or `summarize_deal`.
- Run each tool with the current user's workspace and permission context.
- Require confirmation before high-impact actions such as sending external messages, issuing invoices, changing deal values, deleting records, or triggering payments.
- Log prompt metadata, tool calls, result status, user confirmation, and token/cost usage as appropriate; avoid logging unnecessary sensitive content.
- Enforce per-workspace and per-user rate/usage limits.
- Treat retrieved record content as untrusted input; never follow instructions found inside a customer note, uploaded document, email, or other user-controlled content.
- Provide failure, timeout, and cancellation states.
- Keep a non-AI fallback for core workflows.

### AI privacy and security

- Use only a provider with acceptable data-use terms for the target customer base.
- Never expose provider API keys in the browser.
- Minimize data sent to the model.
- Do not train a model on customer data unless the product explicitly supports it with valid consent and appropriate agreements.
- Do not let the model invent amounts, invoice status, payment success, or completed actions. Read authoritative values from the database and verify action results.

### Acceptance criteria

- AI can only access records the requesting user is allowed to access.
- Generated content is not sent or committed without the applicable user action/approval.
- Every tool call is validated server-side and audit logged.
- Timeouts, refusal, malformed output, and provider failure are handled gracefully.

---

## 14. Phase 10 — Advanced growth modules

Select additions based on customer demand rather than implementing every item automatically.

### Integrations and developer platform

- API tokens scoped to a workspace and limited permissions.
- API versioning, pagination, rate limits, request validation, and audit logs.
- Webhook subscriptions with event allowlist, HMAC signing, delivery attempts, retry/backoff, and replay protection.
- Integration directory with setup status, connection errors, and disconnect controls.
- Start with a small number of integrations selected by beta users.

### Commerce and inventory

- Product catalog refinement, orders, order line items, discounts, tax settings, fulfillment status, and refunds only when payment integration supports them.
- If real stock management is needed, add stock movements, locations, reservations, and reconciliation; don't treat a single editable quantity as a complete audit trail.
- Separate service checkout from physical inventory flows where the business rules differ.

### Analytics

- Saved reports and date filters.
- Sales conversion, pipeline value, overdue invoices, project delivery, utilization, and activity metrics.
- Document metric definitions and date/timezone behavior.
- Use indexed queries or materialized summaries if scale requires them; do not optimize prematurely.

### Mobile

- First ensure the web app is responsive and usable on mobile.
- Consider a PWA before building a separate native app.
- Native applications should be a later decision based on customer usage and push/offline requirements.

### Localization for Filipino MSMEs (optional product direction)

- Asia/Manila timezone and PHP currency available as workspace defaults, not global assumptions.
- Filipino/English-ready labels and Unicode-safe records.
- Payment integrations selected after validating providers and settlement behavior.
- Review Philippine tax, privacy, electronic commerce, invoice, and record-retention requirements with qualified professionals before making compliance claims.

---

## 15. Suggested database model

This is a starting point, not a mandate to create every table immediately. Build only tables needed by the current phase, while preserving the tenancy pattern.

### Platform and access

- `users` (or provider-managed auth identities)
- `workspaces`
- `workspace_memberships` (`workspace_id`, `user_id`, `role`, `status`)
- `workspace_invitations` (hashed/opaque token, invited email, role, expiry, accepted timestamp)
- `user_preferences`
- `audit_logs`

### Core business

- `companies`
- `contacts`
- `contact_company_links` if many-to-many is needed
- `products_services`
- `projects`
- `project_members`
- `tasks`
- `task_comments`
- `activities`
- `files` (metadata only; bytes stored in private object storage)

### CRM

- `leads`
- `pipelines`
- `pipeline_stages`
- `deals`
- `lead_forms`
- `lead_form_submissions`

### Finance

- `estimates`
- `estimate_items`
- `invoices`
- `invoice_items`
- `payments`
- `expenses`
- `expense_categories`

### Client and workflow

- `client_portal_memberships`
- `shared_records` or explicit share tables by resource type
- `documents`
- `document_approvals`
- `notifications`
- `notification_preferences`
- `workflows`
- `workflow_runs`
- `workflow_run_steps`

### Scheduling and time

- `appointment_types`
- `availability_rules`
- `availability_exceptions`
- `bookings`
- `time_entries`
- `timesheet_approvals`

### Team and AI (later)

- `employee_profiles`
- `leave_requests`
- `knowledge_articles`
- `ai_runs`
- `ai_tool_calls`
- `api_tokens`
- `webhook_subscriptions`
- `webhook_deliveries`

### General schema rules

- Every tenant-owned row has a non-null `workspace_id` unless a documented exception exists.
- Use UUIDs or another stable, non-sequential public identifier strategy.
- Add `created_at`, `updated_at`, and relevant actor fields.
- Add unique constraints for workspace-scoped identifiers (for example, invoice numbers per workspace).
- Use foreign keys and deliberate `ON DELETE` behavior.
- Prefer archive/status fields over cascading destructive deletes for important business records.
- Define a consistent strategy for soft deletes and ensure all normal queries filter them out.
- Index common workspace-scoped filters, joins, and sort keys.
- Do not put all custom fields into an untyped JSON object unless there is a documented reason and validation approach.
- For sensitive data, define retention and export/delete behavior before launch.

---

## 16. App information architecture

Suggested left navigation once the relevant phases ship:

- **Overview**
- **Sales**
  - Leads
  - Deals / Pipeline
  - Contacts
  - Companies
  - Forms
- **Work**
  - Projects
  - Tasks
  - Time
  - Bookings
- **Finance**
  - Estimates
  - Invoices
  - Payments
  - Expenses
  - Products & Services
- **Client area**
  - Portal preview / shared files / documents
- **Automation**
  - Workflows
  - Runs and errors
- **Team**
  - Members
  - HR (later)
  - Knowledge base (later)
- **Reports**
- **Settings**
  - Workspace
  - Profile
  - Team and roles
  - Modules
  - Notifications
  - Integrations
  - Billing

Show a navigation item only when its module exists and is available to the workspace. Avoid dead links.

---

## 17. Design system and UX expectations

- Original brand identity; clean, calm, professional B2B SaaS interface.
- Consistent spacing, typography, colors, border radius, and focus states.
- Responsive shell: desktop-first work surfaces, mobile-friendly reading and quick actions.
- Accessible labels, keyboard focus, contrast, and keyboard alternatives to drag-and-drop.
- Every data page includes loading, empty, error, and populated states.
- Confirm irreversible or high-impact actions.
- Use optimistic updates only when rollback/error handling is reliable.
- Show helpful validation next to the field and summarize server errors when useful.
- Avoid fake charts, hard-coded metrics, nonfunctional buttons, lorem ipsum in production surfaces, and simulated payment success.
- Use seed data only in development/demo environments and visibly distinguish demo data from live business data.

---

## 18. Cross-cutting security requirements

1. **Authorization:** define a permission matrix for each domain action (view/create/update/archive/delete/export/manage settings).
2. **Tenant isolation:** `workspace_id` is derived from authenticated membership, not trusted from request payloads.
3. **RLS:** all tenant-owned tables have tested RLS rules. Avoid policies that merely check a user-supplied workspace identifier.
4. **Input validation:** validate all user and public form input on the server; normalize email addresses and other searchable values consistently.
5. **Rate limiting:** protect auth-sensitive and public endpoints, including password reset, lead forms, invitations, and AI endpoints.
6. **CSRF / origin controls:** use the framework's secure mechanisms for mutations and validate webhook origins/signatures where relevant.
7. **File safety:** private storage by default; verify size/type, randomize object keys, check authorization on download, and use expiring signed URLs.
8. **Audit logs:** record security-sensitive events without logging passwords, tokens, secrets, or unnecessary personal data.
9. **Secrets:** use environment variables/secret manager; commit `.env.example`, never `.env` secrets.
10. **Data lifecycle:** define backup/restore, export, workspace deletion, account deletion, and retention handling before production.
11. **Dependency hygiene:** avoid unmaintained packages; keep dependency and migration changes reviewable.
12. **No silent authorization fallbacks:** if workspace membership can't be verified, deny access.

---

## 19. Testing strategy

### Unit tests

- Money calculations, discounts, taxes, rounding, and payment balance.
- Permission helper functions.
- Workflow condition/action validation.
- Scheduling overlap and timezone calculations.
- Data parsing/import validation.

### Integration tests

- Authenticated CRUD across each enabled domain.
- Workspace A vs Workspace B access denial.
- Role-based access for owner/admin/manager/member/client.
- Invoice issue/void/payment transitions.
- Lead conversion without unintended duplicates.
- Private file access checks.
- Workflow retries and idempotency.

### End-to-end tests

At minimum, automate these journeys:

1. Sign up → create workspace → open dashboard.
2. Invite user → accept invitation → verify assigned role.
3. Create company/contact → create project → assign task → complete task.
4. Create lead → move deal across stages → mark won/lost.
5. Create estimate → issue invoice → record partial payment → verify balance.
6. Invite client → share project/document → verify client cannot access unrelated records.
7. Submit public lead form → verify lead and activity entry are created.
8. Trigger a workflow → inspect run → retry a failed step without duplicating side effects.

### Required checks before each phase is considered done

- Formatting/lint passes.
- Typecheck passes.
- Unit tests pass.
- Relevant integration/E2E tests pass.
- Production build succeeds.
- Migrations work from a clean database and from the prior phase's schema.
- Authorization and tenant-isolation tests pass.
- README/docs are updated with any setup or behavior changes.

---

## 20. Definition of done for every feature

A feature is not complete until:

- The UI is connected to real server actions/API endpoints and persisted data.
- Server-side validation and permission checks are implemented.
- Tenant isolation is verified.
- Loading, empty, success, and error states exist.
- Forms are accessible and usable on mobile.
- The database migration and relevant tests are included.
- No secrets or customer data are committed in fixtures/logs.
- Relevant docs are updated.
- There are no placeholder handlers, fake success messages, or knowingly dead controls.

---

## 21. How Claude Code should work

Use these instructions in every session:

1. **Inspect before editing.** Read `README.md`, project configuration, current routes, schema/migrations, tests, and relevant docs before proposing changes.
2. **Confirm the active phase.** Do not implement future phases unless explicitly asked.
3. **Plan the smallest vertical slice.** A slice must include schema/migration, permissions, server logic, UI, and tests where applicable.
4. **Make changes incrementally.** Prefer several coherent small changes over a broad rewrite.
5. **Preserve existing conventions.** Do not replace working architecture or dependencies without a concrete reason.
6. **Use real data.** No UI-only CRUD, fake dashboard values, fake email sends, or fake payment confirmations.
7. **Run checks.** Execute the relevant test, lint, typecheck, migration, and build commands. If a command cannot run, report the exact blocker instead of claiming it passed.
8. **Review security.** For each mutation, ask: Who can do this? Which workspace owns the record? Can a user tamper with IDs? What is logged?
9. **Handle uncertainty responsibly.** If requirements are missing, choose the safest minimal behavior, document the assumption, and keep the scope narrow rather than blocking on avoidable questions.
10. **Summarize every change.** Report files changed, schema changes, behavior delivered, checks run/results, known limitations, and the next phase's prerequisites.

### Avoid

- Implementing all phases in a single giant change.
- Rewriting auth or database access without first understanding the repository.
- Trusting browser-side role checks.
- Storing files publicly by default.
- Using floating-point values for money.
- Building speculative AI autonomy before permissions and audit logs exist.
- Adding complex integrations before the core flow is useful.
- Claiming tax, privacy, e-signature, or legal compliance without verification.

---

## 22. Copy/paste master prompt for Claude Code

Paste this after opening Claude Code in the project repository:

> You are the senior full-stack engineer for an original, multi-tenant small-business SaaS inspired by the business-management software category. Follow `agiled_inspired_saas_mvp_plan.md` as the product and engineering source of truth. Do not copy another product's brand, proprietary UI, code, or wording.
>
> First inspect the repository, current architecture, scripts, database/migrations, auth, and tests. Do not edit files yet. Report the existing stack, risks, missing foundations, and a short proposed task plan for **Phase 0 only**. Keep all work within the current phase.
>
> Implement production-minded software, not a mockup. Every feature must use real persistence and server-side authorization. Enforce tenant isolation in both database policies and server-side code. Add migrations, validation, tests, loading/empty/error states, and documentation with each vertical slice. Never expose secrets. Do not fabricate successful email, payment, webhook, or AI actions. Preserve existing project conventions unless a documented reason justifies a change.
>
> After the phase plan is approved by the user or after completing the explicitly requested phase, run all relevant checks available in the repository and report actual results. Do not claim a command passed unless it was run successfully. End with: (1) implemented scope, (2) files changed, (3) migrations, (4) tests/checks and results, (5) unresolved issues, and (6) the recommended next task. Do not begin the next phase automatically.

---

## 23. Phase-specific prompts

Use one prompt at a time after Phase 0 is complete.

### Phase 1 prompt

> Implement Phase 1 only from `agiled_inspired_saas_mvp_plan.md`: authentication, workspaces, membership/invitations, role foundation, settings, and responsive app shell. Inspect current code first. Add migrations and RLS policies, and prove workspace isolation through automated tests. Do not implement customer CRM, projects, finance, AI, or future-phase modules. Run checks and report actual results.

### Phase 2 prompt

> Implement Phase 2 only: contacts, companies, product/service catalog, projects, tasks, activity, and CSV contact import. Use real database persistence, server validation, pagination, and tenant-aware authorization. Add integration tests for every resource family, including cross-workspace denial. Do not start the sales pipeline or invoicing phases yet.

### Phase 3 prompt

> Implement Phase 3 only: leads, configurable pipeline stages, deals, lead conversion, and public lead capture forms. Add spam protection/rate limits, record linking without accidental duplicates, activity history, and tests. Do not add marketing email campaigns or AI lead scoring.

### Phase 4 prompt

> Implement Phase 4 only: estimates, invoices, line items, expenses, manual payment recording, PDF/print output, and basic financial totals. Use safe money arithmetic, transaction-safe invoice numbering, explicit status transitions, and tests for taxes/rounding/partial payments/voiding. Do not claim local tax compliance or simulate online payment success.

### Phase 5 prompt

> Implement Phase 5 only: client portal, explicit record sharing, private files, proposal approval workflow, and audit trail. Treat the client as a restricted user and test access across unrelated customers/workspaces. Approval records are not to be described as legally compliant electronic signatures.

### Phase 6 prompt

> Implement Phase 6 only: in-app/email notifications and a small deterministic workflow engine with allowlisted triggers/actions, run logs, idempotency, retries, and loop limits. Do not allow workflows to bypass permissions or trigger uncontrolled high-impact actions.

### Phase 7 prompt

> Implement Phase 7 only: appointment types, timezone-aware availability, booking/cancellation/rescheduling, manual time entries/timers, approvals, and billable-time-to-draft-invoice flow. Test booking conflicts under concurrent requests and make conversion idempotent.

### Phase 8 prompt

> Implement only the Phase 8 modules validated as necessary: HR basics, knowledge base, and/or lightweight collaboration. Keep HR data restricted and audited. Do not implement payroll calculations or claim jurisdictional legal compliance.

### Phase 9 prompt

> Implement Phase 9 only: assistive AI drafting/summaries first, then narrowly scoped tool calls. Enforce the requesting user's permissions and workspace context on the server. Require confirmation for external or high-impact operations, log tool execution, set usage/rate limits, and handle provider failures. Do not give the model unrestricted database access.

### Phase 10 prompt

> Implement only the Phase 10 integrations/commerce/analytics/mobile improvements prioritized by actual product needs. Add API scopes, rate limits, webhook signing/retries, and audit logs where applicable. Avoid building a long list of integrations before the underlying business workflows are stable.

---

## 24. First launch checklist

Before inviting real beta customers:

- [ ] Tenant isolation verified by automated tests and reviewed manually.
- [ ] Production environment variables and secrets configured safely.
- [ ] Database migrations and backup/restore procedure documented.
- [ ] Account recovery and invitation flows tested.
- [ ] Privacy policy, terms, data export/deletion process, and support contact prepared.
- [ ] File access and upload limits tested.
- [ ] Error monitoring and basic operational logs enabled.
- [ ] Finance calculations independently tested; local tax requirements reviewed.
- [ ] Demo data is clearly separated from real customer data.
- [ ] Core user journeys tested on desktop and mobile.
- [ ] Known limitations documented honestly.
- [ ] At least a few target businesses have tested the core workflow and provided feedback.

## Recommended first milestone

**Build through Phase 2 first.** This creates a secure, useful foundation for customer and work management. Then use Phase 3 to complete the sales flow and Phase 4 to provide invoicing and cash-flow visibility. Launch a small beta before investing heavily in HR, chat, AI agents, and advanced integrations.
