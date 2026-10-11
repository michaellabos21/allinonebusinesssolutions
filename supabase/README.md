# Database

PostgreSQL through Supabase. The schema so far is backend Phase 1: profiles, workspaces, memberships, invitations and the audit log (`migrations/20261011000001_platform_foundation.sql`).

## Rules

- SQL migrations in `supabase/migrations/` are the source of truth. Never change the schema by hand in the Supabase dashboard.
- One migration per coherent change, named for what it does. Migrations are append-only once merged: fix a mistake with a new migration.
- Every tenant-owned table gets a non-null `workspace_id`, row-level security enabled in the same migration that creates it, and a test proving another workspace cannot read or write it.
- Money columns are `bigint` minor units with an ISO currency code beside them. Timestamps are `timestamptz` in UTC.

## Local stack

Development and tests run against a local Supabase stack in Docker. Docker Desktop must be running.

```bash
npm run db:start    # start the stack and apply migrations
npm run db:reset    # wipe the local database and re-apply every migration
npm run db:stop     # stop the stack; data is kept for next time
```

`config.toml` trims the stack to what the built phases use: the database, auth, the API gateway and Mailpit, which catches outgoing email at http://127.0.0.1:54324 instead of sending it. Storage, realtime, Studio, edge functions and analytics are switched off to save disk space and are turned back on when a phase needs them.

After the first `db:start`, put the local URL and keys in `.env.local` (see `.env.example`). `npx supabase status` prints them. They are development keys for a database on your own machine.

The local auth rate limits in `config.toml` are raised so the test suites are not throttled. A hosted project has its own limits, set in its dashboard.

## Changing the schema

```bash
# Create a migration, then write the SQL in the new file
npx supabase migration new add_contacts

# Re-apply everything from scratch to prove the migrations work on a clean database
npm run db:reset

# Prove the access rules still hold
npm run test:integration
```

Typed database access is not generated yet: `supabase gen types` needs a service that is switched off in the trimmed stack. Row shapes are written by hand in `src/server/`. Generating them is a to-do for Phase 2, when the number of tables makes hand-written types a liability.

## Hosted projects

Nothing is deployed. When a hosted project exists: `npx supabase link --project-ref <ref>`, then `npx supabase db push` applies pending migrations. Never change a hosted schema by hand in the dashboard.

## Seed data

The fictional records in `src/mocks/` are the seed data. They are still loaded in the browser, not the database. When the business tables land in Phase 2, a script will write them into a development workspace through the same server-side functions the app uses, so seeding exercises validation and permissions instead of bypassing them. Seed data is for development and demo workspaces only and must stay visibly labelled as demo data.
