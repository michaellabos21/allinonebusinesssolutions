# Database

PostgreSQL through Supabase. **No tables exist yet.** This folder holds the workflow that backend Phase 1 will start using.

## Rules

- SQL migrations in `supabase/migrations/` are the source of truth. Never change the schema by hand in the Supabase dashboard.
- One migration per coherent change, named for what it does. Migrations are append-only once merged: fix a mistake with a new migration.
- Every tenant-owned table gets a non-null `workspace_id`, row-level security enabled in the same migration that creates it, and a test proving another workspace cannot read or write it.
- Money columns are `bigint` minor units with an ISO currency code beside them. Timestamps are `timestamptz` in UTC.

## Workflow

The Supabase CLI runs through `npx`, so nothing is installed globally.

```bash
# Once per machine: link this folder to the development project
npx supabase login
npx supabase link --project-ref <project-ref>

# Create a migration, then write the SQL in the new file
npx supabase migration new create_workspaces

# Apply pending migrations to the linked project
npx supabase db push

# Regenerate TypeScript types after a schema change
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

A local database (`npx supabase start`) needs Docker, which is not installed on the current development machine. Until it is, migrations and isolation tests run against a hosted development project that holds no real customer data.

## Seed data

The fictional records in `src/mocks/` are the seed data. When the first tables land, a script will write them into a development workspace through the same server-side functions the app uses, so seeding exercises validation and permissions instead of bypassing them. Seed data is for development and demo workspaces only and must stay visibly labelled as demo data.
