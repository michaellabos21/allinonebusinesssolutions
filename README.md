# Workspace — small-business management app

An original all-in-one workspace for freelancers, agencies and small businesses: clients, work and money in one place.

> **Where it stands.** Accounts, workspaces, teams and settings are real: they are saved in a PostgreSQL database and protected by server-side checks and row-level security. **The business screens (contacts, deals, projects, tasks, invoices, expenses, catalog, reports) still show fictional sample data** from `src/mocks/`, held in the browser and reset on reload. Nothing here is ready for real customer data.

Built from two plans in this folder: every UI phase of `agiled_inspired_saas_ui_first_plan.md`, then backend Phases 0 and 1 of `agiled_inspired_saas_mvp_plan.md`.

## Setup

Requires Node.js 20.9 or newer, npm, and Docker Desktop (running) for the local database.

```bash
npm install
npm run db:start
```

The first `db:start` downloads the database images (about 2 GB) and applies the migrations. Then create `.env.local`:

```bash
cp .env.example .env.local
npx supabase status
```

Copy the API URL, the anon key and the service-role key from that output into `.env.local`. They are development keys for a database on your own machine. Then:

```bash
npm run dev
```

Open http://localhost:3000, create an account, and set up a workspace. Email confirmation is off locally, so sign-up signs you in at once. Password-reset emails are caught by Mailpit at http://127.0.0.1:54324 instead of being sent.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Wipe the local database and re-apply every migration |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest); no database needed |
| `npm run test:integration` | Access-rule tests against the local database |
| `npm run test:e2e` | Browser tests (Playwright); builds and serves the app on port 3211, needs the local database |
| `npm run format` / `format:check` | Prettier |

The browser tests need Chromium once per machine: `npx playwright install chromium`.

The integration and browser tests create throwaway accounts (`@isolation.test`, `@e2e.test`) in the local database. The integration tests delete theirs; `npm run db:reset` clears the rest. The integration tests refuse to run against anything but a local database.

If styles look out of date after editing `src/app/globals.css`, stop the dev server, delete `.next/` and start it again.

## Project documents

| Document | What it covers |
| --- | --- |
| `docs/ARCHITECTURE.md` | How the app is built today, the target architecture, decisions made and still open |
| `docs/PRODUCT_ROADMAP.md` | Every backend phase, its status, and what UI already exists for it |
| `docs/DATA_MODEL.md` | The tables each phase will create and how the prototype's records map to them |
| `docs/SECURITY.md` | The rules each phase must meet, and a draft permission matrix |
| `supabase/README.md` | The local database, migrations and seed data |

If styles look out of date after editing `src/app/globals.css`, stop the dev server, delete `.next/` and start it again.

## Stack

Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui on Radix primitives, Lucide icons, Recharts, Sonner toasts.

## Routes

Signed-out pages:

| Route | Purpose |
| --- | --- |
| `/login`, `/signup` | Sign in, create an account |
| `/forgot-password`, `/reset-password` | Request a reset link, choose a new password |
| `/invite/[token]` | Accept an invitation |
| `/onboarding` | Create a workspace (needs a session) |
| `/auth/callback` | Landing point for links in auth emails |

The app itself, all behind sign-in:

| Route | Status |
| --- | --- |
| `/` | Overview dashboard (built) |
| `/crm/contacts` | Contacts list (built) |
| `/crm/contacts/[id]` | Contact detail (built) |
| `/crm/companies` | Companies list (built) |
| `/crm/companies/[id]` | Company detail (built) |
| `/crm/deals` | Leads & Deals board and table (built) |
| `/work/projects` | Projects list (built) |
| `/work/projects/[id]` | Project detail (built) |
| `/work/tasks` | Tasks list and board (built) |
| `/work/calendar` | Month and agenda calendar (built) |
| `/money/invoices` | Invoices list (built) |
| `/money/invoices/new` | Invoice editor (built) |
| `/money/invoices/[id]` | Invoice detail and preview (built) |
| `/money/invoices/[id]/edit` | Edit a draft (built) |
| `/money/expenses` | Expenses (built) |
| `/catalog` | Products & Services (built) |
| `/reports` | Reports (built) |
| `/team` | Team and invitations (built) |
| `/settings` | Profile, workspace, preferences, notifications, appearance (built) |

## What works so far

### Accounts, workspaces and team (real)

- Sign up, sign in, sign out, and reset a forgotten password by email
- Create a workspace with a name, country, currency and time zone; belong to several and switch between them
- Invite a teammate by email address: the app creates a single-use link, valid for seven days, that only that address can accept. **It does not send the email.** You are shown the link once to pass on yourself
- Five roles (owner, admin, manager, member, client). Owners and admins change settings, invite people, change roles and remove members; only the owner manages admins; nobody can change their own role or the owner's
- Profile (name, job title), preferences (date format, first day of the week) and notification choices, saved per account
- Workspace settings (name, currency, default tax, payment terms), saved per workspace and read-only for anyone below admin

Every rule above is enforced three times: in the server action, in a database function, and by row-level security. `npm run test:integration` proves it with 25 tests.

Everything below this line still runs on sample data.

### Shell and overview

- Desktop sidebar that collapses to an icon rail, and a navigation drawer below 1024px
- Topbar with breadcrumbs, search (`⌘K` / `Ctrl+K`) over pages and demo records, quick-create, notifications, help and profile menu
- Workspace switcher (changes the label only; all demo workspaces share the same records)
- Quick-create dialogs for contacts, projects, tasks and invoices, with validation; new records appear on the overview, in search and on their own screens
- Overview: open-invoice statement, summary figures, payments chart with a 3 or 6 month range, pipeline by stage, upcoming tasks you can complete and undo, recent activity
- Demo data switch in the sidebar; switching it off shows the getting-started checklist

### CRM

- **Contacts:** search, status and tag filters, sortable columns, pagination, and row actions to view, edit, archive or restore
- **Contact detail:** notes you can add to, an activity timeline built from the contact's notes and invoices, and related deals, projects and invoices
- **Companies:** search, relationship filter, sorting and pagination, with contact counts and deal and invoice totals rolled up from the records
- **Company detail:** summary figures, people, deals, projects and invoices
- **Leads & Deals:** a board of the four open stages and a table view, search and owner filter, a detail panel, and moving a deal between stages (including Won and Lost) with undo
- Create and edit dialogs for contacts, companies and deals, with validation, duplicate checks and confirmation toasts; archiving asks for confirmation first
- Typing a new company name on a contact creates that company

Deals move between stages through a menu or the detail panel. There is no drag and drop.

### Work

- **Projects:** search, status and owner filters, sorting and pagination; progress is the share of a project's tasks that are done
- **Project detail:** progress, open and overdue task counts, the task list with tick-to-complete, the team (owner plus everyone assigned a task), and an activity log
- **Tasks:** list and board views, with search and status, priority and assignee filters; tasks move between columns through a menu, and a side panel shows details and changes status
- **Calendar:** month grid and agenda list of task due dates, project deadlines and unpaid invoice due dates, with a type filter and a day list
- Create and edit dialogs for projects and tasks, with validation; adding a task from a project or a calendar day fills in that project or date

Completing or moving a task updates the counts on the tasks page, its project and the overview.

### Money

- **Invoices:** totals for awaiting payment, overdue, paid this month and drafts; status filter with counts, search, sorting and pagination
- **Invoice editor:** client, dates, line items (typed or picked from the catalog), an optional flat discount, a tax choice and notes, with live totals
- **Invoice detail:** the invoice as the client would read it, a status timeline, and the actions for its status
- **Expenses:** search, period and category filters, a by-category breakdown of the rows shown, and add, edit and delete
- **Products & Services:** search and type filter, with add, edit, archive and restore

### Reports, team and settings

- **Reports:** a date range (this month, last 3 or 6 months, year to date) drives every panel: headline figures, money in and out by month with a table beside the chart, invoice status, expenses by category, tasks by person, and project progress and spend
- **Team:** real members, roles and invitations (see the first section)
- **Settings:** profile, workspace (name, currency, default tax, payment terms), preferences (date format, first day of the week), notification switches, and appearance (accent colour, density)

What settings change:

- **Workspace name** updates the sidebar, the overview and invoices.
- **Currency** changes how every amount is displayed. Amounts are relabelled, not converted.
- **Default tax and payment terms** apply to new invoices only.
- **Date format and week start** apply everywhere dates and the calendar appear.
- **Notification switches** are saved, but nothing is sent yet.
- **Accent colour and density** apply in the current browser tab only and reset on reload.

How invoice money is handled:

- Amounts are integer centavos throughout. Line total is quantity times unit price, the discount comes off the subtotal, and tax is applied after the discount and rounded once to the nearest centavo (`src/lib/money.ts`).
- An invoice's stored total is always written by that calculation, never typed, so lists, the detail page and the overview agree.
- **Mark as sent** and **Record payment** are simulated. They change the invoice's status only: nothing is emailed and no money moves. Recording a payment marks the whole invoice paid on the demo date.
- Only drafts can be edited. Sent and paid invoices are locked.
- Tax options are demo rates ("No tax" and "VAT 12%") defined in `src/config/app.ts`. They are placeholders, not tax advice.

## Core journeys

Each of these can be completed from start to finish without a backend:

1. **Overview → Create → New contact.** The contact appears in the Contacts list and in recent activity on the overview.
2. **Contacts → search or filter → open a contact.** The detail page shows notes, activity and related deals, projects and invoices.
3. **Projects → open a project → Add task → tick it done.** Progress and open-task counts update on the project, the Tasks page and the overview.
4. **Invoices → New invoice → add lines → Save draft.** The detail page shows the same totals; marking it sent and recording payment (both simulated) updates the list and the overview.
5. **Settings → Workspace → change the name or currency.** The sidebar, overview, invoices and every amount reflect it.

## Quality pass

What was checked in the final phase, and how:

- **Responsive:** an automated sweep of 19 routes at 1440px, 768px and 375px found no horizontal overflow, and no page taller than the viewport at desktop size.
- **Structure and labels:** the same sweep checked for exactly one page heading, an accessible name on every button and link, a label on every form field, no duplicate ids, and a caption on every table. No issues remained.
- **Keyboard:** the skip link is the first tab stop and moves focus to the content. Dialogs take focus, keep it inside while open, close on Esc, and return focus to the control that opened them, including when they were opened from a menu.
- **Contrast:** text and status colours were measured against their backgrounds; all are 4.5:1 or better. Form control outlines and the chart tint were darkened to reach 3:1.
- **Target size:** task tick boxes and the search clear button were enlarged to a 24px or larger hit area.
- **Empty states:** every screen was loaded with demo data switched off.
- **Console:** no errors were logged while navigating all routes.

Not covered: screen reader testing with real assistive technology, and browsers other than Chromium. Automated tests were added afterwards, in backend Phase 0: unit tests for the money, formatting, metrics, report and calendar calculations, and one end-to-end smoke test.

There are no screenshots in this README; the preview tooling available during the build could not capture them at a usable resolution.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/config/app.ts` | **Product name** (`PRODUCT_NAME`), default currency and locale, the fixed demo date, and the currency, tax, accent and notification options |
| `src/config/navigation.ts` | Sidebar structure; also drives breadcrumbs, search and placeholder pages |
| `src/app/globals.css` | Theme tokens: colours, type scale, radius, shadow, focus ring |
| `src/mocks/` | All demo records and their types |
| `src/lib/metrics.ts` | Dashboard figures, derived from the records so totals always reconcile |
| `src/lib/format.ts` | Currency, date and due-date formatting |
| `src/components/providers/demo-store.tsx` | Session state; the seam a real backend will replace |
| `src/components/ui/` | shadcn/ui primitives |
| `src/lib/crm.ts` | Contact timeline and company roll-ups, derived from the records |
| `src/lib/work.ts` | Project progress and team, calendar events and month grid |
| `src/lib/money.ts` | Invoice totals in integer minor units |
| `src/lib/reports.ts` | Date ranges and every report figure |
| `src/lib/runtime.ts` | Current currency, date format and team names for the formatting helpers |
| `src/lib/use-focus-return.ts` | Returns keyboard focus to whatever opened a dialog |
| `src/components/common/` | Page header, panel, data table, toolbar and filters, record form, confirm dialog, states, badges |
| `src/components/crm/` | Contacts, companies and deals screens |
| `src/components/work/` | Projects, tasks and calendar screens, and the task panel |
| `src/components/money/` | Invoices, the invoice editor and document, expenses and catalog |
| `src/components/workspace/` | Reports, team and settings screens |
| `src/components/shell/` | Sidebar, topbar, search, quick-create, the create/edit dialog, menus |
| `src/components/overview/` | Dashboard sections |

To rename the product, change `PRODUCT_NAME` in `src/config/app.ts`.

## Known limitations

Accounts and workspaces:

- Invitation emails are not sent. The link is shown once to the inviter.
- The owner role cannot be transferred, and a workspace cannot be deleted from the app.
- The sign-in email cannot be changed. There are no profile photos.
- The workspace time zone is stored but not yet used: the sample data is pinned to one date (below).
- Manager and client roles exist but have no extra screens or restrictions of their own yet.
- There is no screen for reading the audit log.
- Rate limiting is whatever Supabase Auth provides; the app adds none of its own.
- Nothing is deployed. Email confirmation, production auth limits and a hosted database are all still to set up.

Sample-data screens:

- Business records are not saved. Reloading resets them, and they are the same in every workspace.
- The people on sample tasks, projects and deals (Mara, Paolo, Jenna, Tomas) are fictional, not your team.
- The sample data is pinned to 11 October 2026 (`DEMO_TODAY`) so due dates and month-to-date totals stay consistent.
- Marking an invoice as sent or paid only changes its status. Nothing is emailed and no money moves.
- Money is stored as integer minor units. Changing the currency relabels amounts; it does not convert them.
- Expenses appear in Reports but not on the overview.
- Reports use preset date ranges only; there is no custom range and no export.
- Invoice quantities are whole numbers. There are no partial payments, credit notes, PDFs or printing.
- A detail URL for a record created before a reload shows a "not available" state.
- Archiving is the only removal for contacts, companies, deals and catalog items. Tasks and projects cannot be deleted.
- A project's team is derived from its owner and task assignees.
- The calendar has month and agenda views only.
- Light theme only.
