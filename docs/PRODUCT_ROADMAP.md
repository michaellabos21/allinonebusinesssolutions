# Product roadmap

The phases come from `agiled_inspired_saas_mvp_plan.md`. One phase is built and verified before the next begins. "UI today" describes what is on screen now.

| Phase | Goal | Status | UI today | Not yet designed |
| --- | --- | --- | --- | --- |
| 0 | Repository foundation | **Done** | n/a | n/a |
| 1 | Auth, workspaces, members, settings | **Done** | Sign-up, sign-in, password reset, workspace creation and switching, team, roles, invitations, settings: all real | Email delivery for invitations, owner transfer, sign-in email change, profile photos |
| 2 | Contacts, companies, catalog, projects, tasks, activity | **Done** | All screens on real records, plus CSV contact import with column mapping and preview | Task comments; server-side search and paging past 2,000 rows |
| 3 | Leads, deals, pipeline stages, lead forms | **Done** | Leads with conversion, deals board and table with drag and drop, stage editor, per-deal history, lead forms and public form page, CSV export | Saved views, several pipelines per workspace, alerts for new leads |
| 4 | Estimates, invoices, payments, expenses | **Done** | Estimates and invoices with a shared editor, issue with safe numbering, part payments, void, print or save as PDF, expenses with private receipts, reports on recorded payments | Credit notes, recurring invoices, emailing documents, online payment, server-made PDFs |
| 5 | Client portal and approvals | Not started | None | Everything |
| 6 | Notifications and automation | Not started | Notification menu and preference switches, simulated | Workflow builder, run history |
| 7 | Scheduling and time tracking | Not started | Calendar of due dates only | Bookings, availability, time entries |
| 8 | HR, knowledge base, discussions | Not started | None | Everything; build only on demonstrated need |
| 9 | AI assistant | Not started | None | Everything |
| 10 | Integrations, API, commerce, analytics | Not started | None | Everything; build only on demand |

## First milestone

Build through Phase 2: a secure foundation with real customer and work management. Phase 3 then completes the sales flow and Phase 4 adds invoicing. A limited beta is plausible after Phase 4 or 5, not before.

## Phase 2 decisions

1. Permission matrix: members add and edit contacts, companies and their own tasks; managers and above archive records and manage projects and the catalog; clients see nothing. Enforced in server actions, database functions and row-level security.
2. Demo data: the sidebar switch now covers only invoices and expenses. Sample contacts, projects and tasks can be added to an empty workspace only where `ENABLE_SAMPLE_DATA=true`, which must stay unset anywhere real data lives.

## Phase 3 decisions

1. One pipeline per workspace. Stages belong to the workspace directly; a `pipelines` table can be added if several are ever needed.
2. Members add and edit leads and deals; managers and above archive them and manage stages and lead forms.
3. Public forms are reached only by an unguessable token. Two database functions are open to the public, `get_lead_form` and `submit_lead_form`; neither takes a workspace id or returns anything about existing records. Rate limits live in the database so they hold whatever calls it.
4. Deal history is written by the database to the activity feed, linked to the deal, so it cannot be skipped or forged from the app.

## Phase 4 decisions

1. Finance is for owners, admins and managers only. Members and clients don't see finance pages or figures.
2. The database computes every total and allocates numbers; the browser previews only. Numbers are given at issue, so drafts leave no gaps.
3. Payments are recorded by hand and can't exceed the balance. Voiding is allowed only before any payment; refunds and credit notes are later work.
4. Printing uses the browser's print dialog ("Save as PDF") on a print stylesheet instead of a server PDF renderer, so the printout always matches the stored record.
5. The sample-data switch for invoices and expenses is gone; every finance screen reads the database.
6. Local tax and invoicing rules are not built in. The README says to validate them before production.

