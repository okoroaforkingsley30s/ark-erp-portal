# Supabase integration tests

These tests exercise the deployed database, Auth, Storage, RLS policies, and RPC
transactions. Use a disposable local or dedicated test Supabase project with all
migrations applied. Never provide production credentials.

Required environment variables:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`

Run with `npm run test:integration`. Missing credentials skip the suite cleanly.
Non-local URLs are also refused unless the dedicated environment is explicitly
approved with `ARK_ALLOW_REMOTE_INTEGRATION_TESTS=true`.

The harness creates two uniquely named Auth users and matching application
profiles, then removes only records and objects tagged with that run identifier.
The test database must contain at least one active `finance_accounts` row for the
transaction rollback case.

The business workflow suite also expects the local Supabase Functions runtime to
be running. It verifies Finance maker-checker rejection, Inventory and Dispatch
role boundaries, RR failure rollback, idempotent Auth registration, administrator-
only invitations, and Gmail account binding. It never sends a real email.
