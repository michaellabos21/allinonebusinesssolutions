# Product roadmap

The phases come from `agiled_inspired_saas_mvp_plan.md`. One phase is built and verified before the next begins. "UI" below means a screen exists on demo data; it does not mean the feature works for real.

| Phase | Goal | Status | UI today | Not yet designed |
| --- | --- | --- | --- | --- |
| 0 | Repository foundation | **Done** | n/a | n/a |
| 1 | Auth, workspaces, members, settings | **Done** | Sign-up, sign-in, password reset, workspace creation and switching, team, roles, invitations, settings: all real | Email delivery for invitations, owner transfer, sign-in email change, profile photos |
| 2 | Contacts, companies, catalog, projects, tasks, activity | Not started | All screens | CSV contact import with preview |
| 3 | Leads, deals, pipeline stages, lead forms | Not started | Deals board and table with fixed stages | Leads, lead conversion, configurable stages, public lead form |
| 4 | Estimates, invoices, payments, expenses | Not started | Invoices, invoice editor, expenses, reports | Estimates, partial payments, void, PDF or print layout, receipt uploads |
| 5 | Client portal and approvals | Not started | None | Everything |
| 6 | Notifications and automation | Not started | Notification menu and preference switches, simulated | Workflow builder, run history |
| 7 | Scheduling and time tracking | Not started | Calendar of due dates only | Bookings, availability, time entries |
| 8 | HR, knowledge base, discussions | Not started | None | Everything; build only on demonstrated need |
| 9 | AI assistant | Not started | None | Everything |
| 10 | Integrations, API, commerce, analytics | Not started | None | Everything; build only on demand |

## First milestone

Build through Phase 2: a secure foundation with real customer and work management. Phase 3 then completes the sales flow and Phase 4 adds invoicing. A limited beta is plausible after Phase 4 or 5, not before.

## What Phase 2 needs before it can start

1. A decision on the permission matrix for business records. `docs/SECURITY.md` has the draft: who may create, edit and archive contacts, companies, projects and tasks.
2. A decision on what happens to the demo data toggle once real records exist. The plan allows seed data only in development and demo workspaces.
3. Nothing external. The local database and test suites are in place.
