# Architecture

Status: backend Phase 1. Accounts, workspaces, team and settings are real, backed by PostgreSQL. The business screens still run on in-memory demo data. This document records how the app is built today, where it is going, and the decisions made so far.

## Today

- **Framework:** Next.js 16 App Router with Cache Components, React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui on Radix.
- **Database and auth:** Supabase (PostgreSQL, Supabase Auth), run locally in Docker. SQL migrations are the source of truth.
- **Two kinds of data on screen:**
  - *Real:* the signed-in user, their workspaces, members, invitations and settings. Loaded on the server in `src/app/(workspace)/layout.tsx` and changed only through server actions.
  - *Demo:* contacts, companies, deals, projects, tasks, invoices, expenses and the catalog. Fictional records from `src/mocks/`, held in React state and reset on reload.

```
src/proxy.ts                       session refresh and sign-in redirects, before every request
src/app/(auth)/                    sign-in, sign-up, password reset, onboarding, invitation pages
src/app/(workspace)/               the app; its layout verifies the session and loads the account
src/app/auth/callback/route.ts     landing point for links in auth emails
src/server/session.ts              who is signed in, their workspaces, team and invitations
src/server/permissions.ts          the one place that says which role may do what
src/server/validation.ts           Zod schemas for every server action's input
src/server/actions/                server actions: auth, workspace, profile, team
src/lib/supabase/server.ts         Supabase client carrying the user's session
src/components/<domain>/           one screen per file
src/components/providers/          demo-store.tsx: demo records plus the real account
src/lib/                           pure calculations and formatting, unit tested
supabase/migrations/               the schema
tests/integration/                 access-rule tests against a real database
e2e/                               browser tests of the main journeys
```

## How a real mutation flows

Taking "change a member's role" as the example:

1. The Team screen calls `setMemberRoleAction` (a server action).
2. The action parses its input with a Zod schema, loads the session, and checks `can(role, "members.change_role")`.
3. It calls the `set_member_role` database function as the signed-in user.
4. The function re-checks everything itself: the caller's role, that the target is not the caller, that the owner is not involved, that only the owner touches admins. It updates the row and writes the audit log in the same transaction.
5. The action calls `refresh()`, the layout re-reads the team, and the screen updates.

Steps 2 and 4 are deliberately redundant. Either alone would stop a forbidden change.

## The seam for the remaining demo data

Business screens never import records. They call `useDemoStore()` and get lists plus functions such as `saveContact` or `recordInvoicePayment`. That hook is the boundary each later phase replaces, **one domain at a time**. For each domain the work is a vertical slice: migration and row-level security, server-side data access with validation and permission checks, the screens switched from the store to real queries and server actions, then integration and browser tests. Domains not yet migrated keep running on the store, labelled as demo data.

The demo records refer to four fictional teammates (Mara, Paolo, Jenna, Tomas) as owners and assignees. They are not real members. That mismatch disappears as each domain moves to the database and points at real users.

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
| App routes | Stay at `/`, with `/login`, `/signup` and the rest beside them | Moving every screen under `/app` would touch every link for no user benefit |
| Development database | Local Supabase in Docker, trimmed to database, auth, API and mail catcher | Nothing shared, nothing hosted, tests can create and delete accounts freely |
| Supabase client or ORM | Supabase client | The plan's default; one approach, not two |
| Where writes are authorised | In the server action and again in a database function | The database is the last line of defence; the action gives the friendly error |
| Navigation after a session change | Full page load, not a client-side redirect | With Cache Components the browser keeps prerendered pages per session, including streamed redirects, and replays them. A full load discards them |
| Redirects in the workspace layout | A client component that does a full load, not `redirect()` | Same reason: a streamed `redirect()` is cached with the page |
| Workspace page content | Rendered on the client after settings are applied | Formatting helpers read currency and date format from a module-level snapshot. Rendering it on the server would share that snapshot between requests from different workspaces |
| Next's instant-navigation check | Opt-in per segment (`manual-warning`) | Every workspace page waits for the session, so the default check flags all of them |
| Roles | The plan's five, as a database enum | Manager and client exist now so later phases do not need a migration to add them |
| Invitation delivery | Show the link to the inviter; send nothing | No email provider is configured, and the app must not fake a send |
| Unit tests | Vitest | Fast, and the pure `src/lib` and `src/server` functions need no browser |
| Integration tests | Vitest against the local database | Access rules can only be proved against real row-level security |
| End-to-end tests | Playwright against a production build | Tests what would ship |
| Formatting | Prettier, 100 columns | Matches the existing code |

## Open decisions

- **Email delivery.** Invitations and, later, invoices need a provider. Until one is chosen, links are copied by hand. Auth emails (confirm, reset) are sent by Supabase itself; locally they land in Mailpit.
- **Email confirmation on sign-up.** Off locally, so sign-up signs you in at once. The code handles both. A hosted project should turn it on.
- **Generated database types.** Row shapes are hand-written for now. See `supabase/README.md`.
- **Record ids.** Demo ids are short strings (`c1`); real ids are UUIDs, so detail URLs change when each domain migrates.
- **Hosting.** Nothing is deployed.

## Things that must not survive to production

- The fixed demo date (`DEMO_TODAY`). Real code uses the clock and the workspace's timezone. The timezone is stored already but not yet used for display.
- `src/lib/runtime.ts`, and rendering workspace pages only on the client because of it. It goes when formatting takes its settings as arguments or from context.
- Simulated actions on demo records: marking invoices sent or paid. Each becomes real in its phase or is removed. None may ship as a fake success.
- The appearance settings living only in the browser tab.
