# Workspace — business management UI prototype

An original all-in-one workspace for freelancers, agencies and small businesses: clients, work and money in one place.

> **This is a UI-only prototype.** Every record you see is fictional demo data from `src/mocks/`. There is no database, authentication, payment processing, email or external API. Anything you create is held in memory and disappears when you reload the page.

Current scope: **all UI phases (0 to 6)** of `agiled_inspired_saas_ui_first_plan.md`. Every screen in the sidebar is built and the UI quality pass is done. No backend work has started.

## Setup

Requires Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

There is no test runner configured yet.

If styles look out of date after editing `src/app/globals.css`, stop the dev server, delete `.next/` and start it again.

## Stack

Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui on Radix primitives, Lucide icons, Recharts, Sonner toasts.

## Routes

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
- **Team:** members with roles and open task counts, role changes between Admin and Member, and an invite flow that adds a pending invitation you can resend or cancel
- **Settings:** profile, workspace (name, currency, default tax, payment terms), preferences (date format, first day of the week), notification switches, and appearance (accent colour, density)

What settings change, and what they don't:

- **Workspace name** updates the sidebar, the overview and invoices.
- **Currency** changes how every amount is displayed. Amounts are relabelled, not converted.
- **Default tax and payment terms** apply to new invoices only.
- **Date format and week start** apply everywhere dates and the calendar appear.
- **Profile name** updates the account menu, task and deal assignee names and new activity entries. Activity already logged keeps the old name.
- **Invitations, role changes and notification switches** only change what is shown. No email is sent, nobody can accept an invitation, and roles do not restrict anything.
- Saving a profile, workspace or preference change re-renders the page so every formatted value updates (`src/lib/runtime.ts` explains why).

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

Not covered: screen reader testing with real assistive technology, browsers other than the Chromium-based preview, and automated tests (none exist).

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

- Nothing is saved. Reloading resets every change.
- The demo is pinned to 11 October 2026 (`DEMO_TODAY`) so due dates and month-to-date totals stay consistent whenever it is run.
- Money is stored as integer minor units. Changing the currency in settings relabels amounts; it does not convert them.
- Expenses appear in Reports but not on the overview.
- Reports use preset date ranges only; there is no custom range and no export.
- Invoice quantities are whole numbers. There are no partial payments, credit notes, PDFs or printing.
- Sign-out, workspace switching, notifications, invitations and roles are simulated.
- Light theme only. The accent colour and density can be changed in settings.
- A detail URL for a record created in an earlier session shows a "not available" state, because nothing is persisted.
- Archiving is the only removal; there is no permanent delete.
- Tasks and projects cannot be deleted. A task can be marked done and a project marked completed.
- A project's team is derived from its owner and task assignees; there is no separate member list to manage.
- The calendar has month and agenda views only. There is no week view and nothing can be dragged to a new date.
