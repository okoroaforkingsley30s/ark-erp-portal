# Local Supabase pre-deployment testing

This procedure uses Docker Desktop and never writes to the live ARK ONE project.
It is the required release-candidate checkpoint before production deployment.

## Why a schema baseline is still required

The repaired migration sequence contains the new security and transactional
changes, but the original repository did not contain the definitions for several
pre-existing operational tables, including `part_requests`, `repair_jobs`,
`spare_parts_inventory`, and `tickets`. A blank Docker database therefore cannot
reproduce the live schema until a **schema-only** baseline is captured.

The baseline must contain structure only—never employee, finance, ticket, Gmail,
or customer data. Save it as:

`supabase/migrations/202606300000_production_schema_baseline.sql`

Its earlier timestamp ensures the existing 29 migrations run after it in order.

## Windows prerequisites

1. Install and start Docker Desktop using Linux containers.
2. Open CMD in the repaired `ark-erp-portal` directory.
3. Run `npm install`.
4. Obtain the direct database host and user from the Supabase database connection
   settings. Do not send the database password through chat or save it in a file.
5. Run the read-only schema exporter and enter the password only at its secure
   prompt:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\export-production-schema.ps1"
```

   The exporter runs PostgreSQL `pg_dump` in Docker, restricts the export to the
   `public` schema, requests schema only, removes ownership/privilege statements,
   rejects row data, and confirms that the required operational tables exist.
6. Review the resulting SQL before continuing. It must contain definitions but
   no `COPY` or `INSERT INTO` statements.
7. Run:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\test-local-supabase.ps1"
```

The script refuses to continue without Docker, the baseline, or the core
operational tables. It starts local Supabase and Edge Functions, rebuilds the
database from the migration sequence, obtains temporary local keys, and runs the
integration suite. Dummy Google credentials are stored only in the Windows temp
directory during the test and are deleted afterward; no real email is sent.

Useful local commands:

```cmd
npx supabase status
npx supabase stop
```

Local Studio normally opens at `http://127.0.0.1:54323`. Auth emails are captured
locally by Inbucket and are not delivered to real recipients.

## Pass criteria

- Every migration applies from an empty database.
- The 11 Supabase integration tests pass rather than skip.
- No production URL, key, database password, or customer data is used.
- Test users, documents, and workflow records remain inside Docker.
