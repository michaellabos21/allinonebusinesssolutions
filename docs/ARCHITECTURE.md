# Architecture

Status: backend Phase 0. The app is a complete UI running on in-memory demo data. No database, authentication or server logic exists yet. This document records how it is built today, where it is going, and the decisions made so far.

## Today

- **Framework:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui on Radix.
- **Rendering:** every page is a thin server component that renders one client screen component. All data and interaction live on the client.
- **Data:** `src/mocks/` holds fictional records. `src/components/providers/demo-store.tsx` loads them into React state and exposes every read and write the screens use. Nothing persists.
- **Derived figures:** `src/lib/metrics.ts`, `reports.ts`, `crm.ts`, `work.ts` and `money.ts` are pure functions over records. They have unit tests and do not depend on React or on where the records come from.
- **Settings:** `src/lib/runtime.ts` mirrors currency, date format and team names for the formatting helpers. It exists only because there is no server.

```
src/app/(workspace)/…/page.tsx     thin route files
src/components/<domain>/           one screen per file: crm, work, money, workspace, overview
src/components/common/             table, toolbar, form, dialogs, states, badges
src/components/shell/              sidebar, topbar, search, the create/edit dialog
src/components/providers/          demo-store.tsx, the data seam
src/lib/                           pure calculations and formatting
src/mocks/                         demo records, later the seed data
```

## The seam

Screens never import records. They call `useDemoStore()` and get lists plus functions such as `saveContact` or `recordInvoicePayment`. That one hook is the boundary a backend replaces.

It will be replaced **one domain at a time**, not in one change. For each domain the work is a vertical slice: migration and row-level security, server-side data access with validation and permission checks, the screens switched from the store to real queries and server actions, then tests. Domains not yet migrated keep running on the store, clearly labelled as demo data, until their phase.

## Target

- **Database:** PostgreSQL through Supabase, with SQL migrations as the source of truth (see `supabase/README.md`).
- **Auth:** Supabase Auth, with sessions read on the server.
- **Data access:** one module per domain under `src/server/<domain>/`, the only code allowed to query that domain's tables. Each function takes the authenticated context, never a client-supplied workspace id.
- **Mutations:** server actions that validate input with Zod, check permission through central helpers, then call the data-access module.
- **Reads:** server components fetch through the same modules; client components receive data as props.
- **Authorisation:** enforced twice, in server code and in row-level security. See `SECURITY.md`.
- **Validation:** Zod schemas per domain, shared by forms and server actions.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| App routes | Stay at `/`, with `/login` and `/signup` added beside them | Moving every screen under `/app` would touch every link for no user benefit |
| Supabase client or ORM | Supabase client with generated types | The plan's default; one approach, not two |
| Unit tests | Vitest | Fast, and the pure `src/lib` functions need no browser |
| End-to-end tests | Playwright against a production build | Tests what would ship |
| Formatting | Prettier, 100 columns | Matches the existing code |
| shadcn components | Left in the CLI's own style, excluded from Prettier | Upstream updates diff cleanly |

## Open decisions

- **Where the development database runs.** A local Supabase stack needs Docker, which is not installed. The alternative is a hosted development project. Needed before Phase 1.
- **Roles.** The UI has Owner, Admin and Member. The plan has owner, admin, manager, member and client. Phase 1 has to settle the list and the permission matrix.
- **Record ids.** Demo ids are short strings (`c1`); real ids will be UUIDs, so detail URLs change when each domain migrates.

## Things the prototype does that must not survive

- The fixed demo date (`DEMO_TODAY`). Real code uses the clock and the workspace's timezone.
- `src/lib/runtime.ts` and the page remount on settings changes.
- Simulated actions: marking invoices sent or paid, invitations, role changes, sign-out. Each becomes real in its phase or is removed. None may ship as a fake success.
