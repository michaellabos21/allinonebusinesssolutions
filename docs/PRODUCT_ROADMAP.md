# Product roadmap

The phases come from `agiled_inspired_saas_mvp_plan.md`. One phase is built and verified before the next begins. "UI" below means a screen exists on demo data; it does not mean the feature works for real.

| Phase | Goal | Status | UI today | Not yet designed |
| --- | --- | --- | --- | --- |
| 0 | Repository foundation | **Done** | n/a | n/a |
| 1 | Auth, workspaces, members, settings | Not started | Shell, team, invitations and settings, all simulated | Sign-up, login, password reset, invitation acceptance, workspace creation |
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

## What Phase 1 needs before it can start

1. A decision on where the development database runs (see `ARCHITECTURE.md`).
2. A Supabase project and its keys in `.env.local`, entered by the project owner.
3. Agreement on the role list and permission matrix drafted in `SECURITY.md`.
