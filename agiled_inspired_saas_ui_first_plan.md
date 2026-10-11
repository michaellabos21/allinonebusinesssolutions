# UI-First Build Plan — Agiled-Inspired Business OS

## Goal
Build and validate the frontend experience before connecting authentication, database, billing, or other backend services. The result of this stage should be a polished, responsive, navigable SaaS UI prototype using clearly defined mock data and reusable components. Keep the design original; do not copy Agiled's exact branding, layout, text, or assets.

## Product direction
- Product category: all-in-one business management SaaS for freelancers, agencies, consultants, and small businesses.
- Temporary product label: `Workspace` (keep it centralized in configuration so it can be renamed easily).
- Visual style: calm, modern, professional SaaS; light theme first; warm off-white/white surfaces, deep slate text, restrained indigo/blue accent, subtle borders, small radii, clear typography, generous but efficient spacing.
- Avoid: gradient-heavy marketing visuals, oversaturated colors, excessive glassmorphism, placeholder lorem ipsum, charts with meaningless numbers, dead buttons, and a pixel-for-pixel copy of any existing product.
- Responsive behavior: desktop-first for the admin workspace but fully usable on tablet and mobile. Sidebar becomes a drawer/collapsible navigation on smaller screens.

## Operating rules for Claude Code
1. Inspect the existing repository before changing it. Preserve working conventions and scripts. If the repo is empty, initialize the stack below.
2. Work UI-first. Do not integrate Supabase, a database, live authentication, payment processing, real email delivery, or external APIs in this stage.
3. Use TypeScript and realistic, centralized mock data. Keep mocks in a dedicated `src/mocks/` or equivalent directory rather than embedding arrays in page components.
4. All visible controls must do something meaningful in prototype scope: navigation routes, search filters mock rows, tabs change views, dropdowns open, dialogs validate basic input, and forms update local prototype state. Where backend persistence would normally happen, show a clear prototype-only success state and keep the new item in local state for the current session.
5. Do not represent mock data as real business data. Add a small unobtrusive `Demo data` indicator in the workspace or make the prototype status obvious in the README.
6. Build reusable primitives before repeating patterns. Avoid one giant component and avoid premature abstraction.
7. Add loading, empty, error, and success states where a screen needs them. Include keyboard focus, labels, reasonable contrast, and accessible dialog behavior.
8. Do not claim a feature is production-ready when it is only simulated in the UI.
9. Do not begin backend work until the user explicitly approves the UI and requests the next phase.
10. After each phase, run available lint, typecheck, test, and build scripts; fix issues and summarize changed files and routes.

## Default stack
Use the current repository's stack if it already works. Otherwise use:
- Next.js App Router
- React + TypeScript strict mode
- Tailwind CSS
- shadcn/ui or an equivalent accessible component system
- Lucide icons
- Recharts for realistic dashboard charts
- React Hook Form + Zod only for substantial forms
- Mock data and local component state; no backend or network dependency

## Navigation and information architecture
Main workspace sidebar:
- Overview
- CRM
  - Contacts
  - Companies
  - Leads & Deals
- Work
  - Projects
  - Tasks
  - Calendar
- Money
  - Invoices
  - Expenses
- Catalog
  - Products & Services
- Reports
- Team
- Settings

A few later-stage destinations (Client Portal, Automations, AI Assistant, HR, Integrations) may be shown as disabled or `Coming later` entries, but don't fill the UI with nonfunctional menu items. Keep this list short and purposeful.

Top application bar:
- Sidebar toggle
- Breadcrumb/page title area
- Global search affordance (functional against demo records for the screens implemented)
- Quick-create button
- Notifications UI (demo only)
- Help affordance
- User menu/profile menu
- Workspace switcher (demo selection only)

## Visual system
Create design tokens for:
- Background, surface, elevated surface, border, text, muted text, primary, primary-hover, success, warning, danger
- Spacing and radius conventions
- Typography scale for page title, section title, body, helper text, labels, and numbers
- Shadow and focus-ring conventions

Reusable components should include:
- `AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `Breadcrumbs`
- `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Checkbox`, `Tabs`, `Badge`
- `DataTable`, `TableToolbar`, `SearchInput`, `FilterMenu`, `Pagination`
- `StatCard`, `ChartCard`, `EmptyState`, `LoadingSkeleton`, `ErrorState`
- `Dialog/Modal`, `DropdownMenu`, `Tooltip`, `Toast`, `ConfirmDialog`
- `Avatar`, `AvatarGroup`, `UserMenu`
- `StatusBadge`, `PriorityBadge`, `CurrencyAmount`, `DateLabel`

## UI implementation phases

### UI Phase 0 — Repository audit and design foundation
**Build:**
- Inspect repository and summarize current stack and constraints.
- Set up or refine theme tokens and global CSS.
- Create a consistent type scale, spacing system, page containers, and accessible interactive primitives.
- Configure icon usage and button/input variants.
- Add the responsive shell skeleton and route conventions.

**Acceptance criteria:**
- App runs locally and has no type or build errors.
- Theme tokens are centralized.
- Core components have consistent sizing and focus states.
- No backend dependencies are introduced.

### UI Phase 1 — App shell and Overview dashboard
**Build:**
- Desktop sidebar, mobile navigation drawer, topbar, workspace switcher, user menu, breadcrumbs.
- Overview dashboard with believable demo data: revenue summary, open invoices, active projects, tasks due, recent activity, upcoming tasks, pipeline summary.
- Quick-create menu (new contact, project, task, invoice) that opens forms or navigates to the relevant page.
- A useful getting-started empty state when demo data is disabled or empty.

**Acceptance criteria:**
- Sidebar and topbar are responsive and keyboard accessible.
- Each navigation item routes correctly.
- Dashboard cards and charts use centralized demo data.
- No random or contradictory metrics; values reconcile with demo records where practical.
- Quick-create actions have working prototype behavior.

### UI Phase 2 — CRM screens
**Build:**
- Contacts list with search, status/tag filters, sorting, pagination, row actions, and create/edit dialog.
- Contact detail page with summary, notes, related projects, related invoices, and an activity timeline.
- Companies list and company detail page.
- Leads & Deals board with stages, deal detail panel, filters, and a table/board toggle if achievable without undue complexity.
- Add confirmation dialogs for destructive/archive actions.

**Acceptance criteria:**
- Search and filters visibly update the dataset.
- Create/edit/archive actions update local mock state for the session.
- Contact and company detail routes resolve correctly.
- Forms show validation and success/error feedback.

### UI Phase 3 — Projects and tasks
**Build:**
- Projects overview/list with status, owner, client, progress, and due date.
- Project details with overview, task list, team members, and activity.
- Tasks page with list/Kanban toggle, status and priority filters, due dates, assignees, and task detail dialog.
- Calendar page with a clean month/week agenda view or a usable agenda list if a complete calendar library is not already installed.

**Acceptance criteria:**
- Changing a task status updates visible cards and counts.
- Filters and views work with demo data.
- Create/edit task and project dialogs are usable and validated.
- Layout remains usable on phone-sized screens.

### UI Phase 4 — Money screens
**Build:**
- Invoices list with status tabs, search, totals, due dates, and create-invoice flow.
- Invoice details/preview, item rows, customer selection, subtotal, discount (optional), tax (clearly demo-configurable), and total calculations.
- Expenses list and add-expense dialog.
- Products & Services catalog with add/edit/archive flows.
- Format currency from a centralized workspace setting; use PHP (₱) and `en-PH` as the initial demo default, but don't hard-code currency formatting throughout the UI.

**Acceptance criteria:**
- Money calculations use integer minor units or a safe decimal strategy; do not use floating-point sums carelessly.
- Invoice preview and list show consistent totals and status.
- All creation flows work in local prototype state.
- Mark payment actions are labeled as simulated/demo actions and do not imply an actual payment was processed.

### UI Phase 5 — Reports, team, and settings
**Build:**
- Reports overview with date-range controls and at least sales, invoice status, project/task, and expense visualizations based on the demo data.
- Team list with role badges and an invite-member modal (simulated).
- Profile, workspace, preferences, notification, and appearance settings screens.
- Module settings placeholders only where they support the navigation story; avoid empty pages with no explanatory content.

**Acceptance criteria:**
- Report filters update charts/tables or clearly indicate which demo data range is being shown.
- Settings forms validate and update local state.
- Invite-member flow produces a visible simulated pending invitation.
- All screens have realistic empty states.

### UI Phase 6 — UI quality pass and handoff
**Build:**
- Responsive audit at desktop, tablet, and mobile breakpoints.
- Accessibility pass for focus order, form labels, dialog behavior, keyboard operation, and contrast.
- Consistent loading/empty/error/success states.
- Fix overflow, clipped tables, inconsistent spacing, and icon/button alignment.
- Add concise README section with run commands, route list, demo-data notice, known UI-only limitations, and screenshots if practical.

**Acceptance criteria:**
- `lint`, `typecheck`, tests, and production build pass where configured.
- No visible primary button is inert.
- No broken routes or runtime console errors in normal navigation.
- User can complete core demo journeys from start to finish without a backend.
- UI-only limitations are documented honestly.

## Recommended build scope for the first pass
Do not attempt every screen in one prompt. Implement only UI Phase 0 and UI Phase 1 first. Review the design, then proceed screen group by screen group.

## Core demo journeys to support
1. Overview → Quick Create → New Contact → Contact appears in list and dashboard activity.
2. Contacts → Search/filter → Open Contact → View related records.
3. Projects → Open Project → Create Task → Change status → Task counts update.
4. Invoices → Create Invoice → Add line items → Preview total → See invoice in list.
5. Settings → Update workspace name/currency → visible UI reflects the changes.

## Master prompt for Claude Code
Copy and paste the following prompt from the repository root:

> We are building an original all-in-one small-business management SaaS inspired by the broad product category of tools like Agiled. Do not copy any product's exact UI, branding, wording, source code, or assets.
>
> Read `agiled_inspired_saas_ui_first_plan.md` completely before making changes. First inspect the existing repository: identify the framework, package manager, scripts, routes, styling, components, and any unfinished work. Preserve existing conventions where possible. Do not overwrite working code just to match a preferred stack.
>
> We are explicitly doing a UI-first prototype. Implement **UI Phase 0 and UI Phase 1 only** from the plan. Do not proceed to CRM, projects, finance, or backend integration yet. Do not add a database, Supabase, authentication provider, payments, real email, external APIs, or production business logic. If the repo is empty, use Next.js App Router, React, strict TypeScript, Tailwind CSS, an accessible component library such as shadcn/ui, and Lucide icons.
>
> Build an original polished responsive SaaS app shell with a restrained light theme, professional typography, subtle borders, clear hierarchy, and a compact but comfortable layout. Include a desktop sidebar, a working mobile navigation drawer, a topbar, workspace switcher demo, global search affordance, quick-create menu, notifications demo, and profile menu. Build the Overview dashboard with centralized realistic demo data, revenue/invoice/project/task summary cards, one or two useful charts, recent activity, upcoming tasks, and a getting-started state. Keep the product name in one configuration constant so it is easy to change.
>
> All links and visible controls included in this phase must work in prototype scope. Use local state for simulated interactions and label simulated actions honestly. Centralize demo data; don't hardcode data directly into large page components. Create reusable components and theme tokens without overengineering. Ensure accessibility, keyboard focus, appropriate labels, and responsive behavior. Include loading, empty, and error patterns where useful.
>
> Before coding, write a brief implementation checklist based on the current repository. Then implement the phase. After coding, run the available lint, typecheck, test, and build commands. Fix errors introduced by your changes. Do not claim commands passed unless you actually ran them. Update the README with setup instructions and a clear note that the current app is a UI-only prototype using demo data. In your final response, summarize changed files, routes, interactions tested, command results, limitations, and the exact next phase you recommend. Stop after UI Phase 1 and wait for review.

## Recommended follow-up prompts
- After review: “Implement UI Phase 2 only. Read the plan again, preserve the approved design system, and implement CRM screens with centralized mock data and working local interactions. Do not add backend services. Run checks and stop.”
- For each later phase, replace the phase number and name, require acceptance criteria to be tested, and keep the scope limited to that phase.

## Definition of done for this UI-first stage
A reviewer can run the app locally, navigate the workspace shell, understand the main information architecture, interact with the overview dashboard, and approve the visual system before any backend decisions are locked in.
