# ARK ONE Operations Runbook

## 1. Purpose and environments

This runbook controls repository setup, access roles, database migrations,
deployment, rollback and recovery. It does not contain credentials.

| Environment | Purpose | Permitted data | Deployment rule |
| --- | --- | --- | --- |
| Local | Development and destructive testing | Synthetic data only | Docker Desktop only |
| Staging | Release-candidate and UAT | Synthetic or approved sanitized data | Must use separate Supabase and hosting projects |
| Production | Live company operations | Live business data | Approved release only after all gates pass |

Never reuse the production service-role key, database password, OAuth secret or
Gmail token in local or staging environments.

## 2. Repository setup

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and populate only the environment being
   used. Do not commit the result.
3. Install Docker Desktop for local Supabase and Playwright Chromium for browser
   tests.
4. Run the required verification commands from the repository root.

The frontend may receive only public Supabase URL/anonymous-key values through
`VITE_*`. Supabase service-role, Gmail, Resend and OAuth state secrets belong in
the Edge Function secret store.

## 3. Identity and roles

Identity starts in Supabase Auth and is linked to application records through
`auth_user_id`. Email is a normalized lookup and display attribute; it is not an
authorization identity. The database and Edge Functions—not request bodies or
route visibility—decide access.

| Role group | Canonical roles | Primary responsibility |
| --- | --- | --- |
| Platform | `system_admin`, `head_of_it`, `it` | Configuration, identity administration and technical operations |
| Executive | `ceo`, `agm`, `manager` | Cross-functional oversight and approvals |
| Administration | `admin_head`, `admin` | Administrative workflows and records |
| Operations | `operations`, `helpdesk` | Ticket intake, operational review and coordination |
| Engineering | `engineer` | Assigned field work and receipt confirmation |
| Repair & Refurbishment | `repair_head`, `repair_technician` | RR intake, assignment, repair and QA separation |
| Inventory | `inventory` | Stock, requests, dispatch and custody |
| Finance | `head_of_account`, `finance` | Journal, expense, payment and checker workflows |
| Procurement | `procurement` | Purchase requests and purchase orders |
| Business Development | `head_of_business_development`, `business_developer` | CRM, clients and follow-up |
| Human Resources | `hr` | Employee and HR workflows |
| External | `client` | Explicitly permitted client functions only |

Legacy aliases are normalized by `src/lib/roleAccess.js`. New roles must be added
to frontend permission definitions and database authorization policies together.
Frontend route checks are user-interface protection only; RLS/RPC authorization
is mandatory.

## 4. Migration management

Migrations live in `supabase/migrations` and use
`YYYYMMDDHHMM_description.sql`. Never edit a migration already applied to a shared
environment. Add a later corrective migration instead.

Before applying migrations:

1. Confirm the target project and environment.
2. Create and verify a recoverable database backup.
3. Run `npm run validate:migrations`.
4. Run a fresh local `npx supabase db reset`.
5. Run `npm run test:integration` against the local database.
6. Apply to staging and complete UAT.
7. Review SQL for locks, destructive statements and data backfills.

The required `202606300000_production_schema_baseline.sql` must be a schema-only
representation of the pre-existing operational database. It must not contain HR,
finance, ticket, customer, Gmail or authentication records.

## 5. Release gates

A release candidate must pass:

- migration validation and blank-database reset;
- lint and incremental type-check;
- unit tests and coverage thresholds;
- Supabase Auth/RLS/RPC/Storage integration tests;
- desktop and mobile browser journeys;
- dependency and secret scans;
- production build;
- role-based UAT for Helpdesk, Operations, Engineer, Inventory, RR, Finance and
  administrator workflows.

Any skipped database test means the database gate has not passed.

## 6. Deployment sequence

Use a tagged, reviewed commit. Record the commit SHA, migration list, function
versions, operator and timestamp in the change record.

1. Announce the maintenance window and pause high-risk Finance/Inventory writes.
2. Verify the current production backup and restore instructions.
3. Reconfirm the Supabase project reference before every remote command.
4. Apply database migrations in filename order.
5. Run database security/schema audit RPCs and smoke queries.
6. Deploy Edge Functions from the same release commit.
7. Set/verify secrets by name; never print their values into logs.
8. Deploy the frontend using production public environment values.
9. Run read-only smoke tests, then controlled write tests with dedicated test
   records.
10. Resume users only after authentication, core workflows and audit logging pass.

Do not deploy automatically from an unprotected developer branch. GitHub Actions
validates releases but does not deploy this repository.

## 7. Post-deployment checks

- Sign in with a non-administrator role and confirm forbidden modules remain
  inaccessible.
- Confirm invitation/password links use the production HashRouter URL.
- Confirm RLS prevents cross-user notification, document and Gmail access.
- Create and reverse a test journal using separate maker/checker accounts.
- Process a synthetic part through Operations, Inventory, RR and dispatch.
- Confirm lifecycle/audit rows exist for each successful transition.
- Upload a private test document and verify signed-URL expiry and ownership.
- Review Supabase database, Auth, Storage and Edge Function error logs.

Remove all synthetic production test records through approved application/RPC
paths and preserve the audit trail.

## 8. Rollback

Frontend rollback is preferred when the database remains compatible: restore the
previous successful hosting deployment or redeploy the previous release tag.

Edge Function rollback: deploy the function sources from the previous release tag
and re-run authorization smoke tests.

Database migrations are forward-only by default. Do not improvise `DROP`, delete
or restore commands on production. If an additive migration fails, stop the
release, keep the frontend on the compatible version and create a reviewed
corrective migration.

A full database restore is an emergency operation requiring an approved outage,
confirmed backup timestamp and explicit authorization because it can discard all
writes after the backup.

## 9. Recovery priorities

1. Contain: disable the affected release/function or pause writes.
2. Preserve: capture timestamps, logs, release SHA and affected record IDs.
3. Assess: determine whether integrity, confidentiality or availability is
   affected.
4. Recover: use the least destructive compatible rollback.
5. Validate: run authentication, RLS, financial balance, inventory quantity and
   audit-continuity checks.
6. Resume: restore user access gradually and monitor errors.
7. Review: document cause, data impact, corrective migration and prevention.

For suspected secret exposure, revoke/rotate the credential first, then redeploy
dependent functions and invalidate affected sessions or OAuth bindings. Removing
a secret from Git history does not revoke it.

## 10. Ownership and approvals

- Technical operator: prepares release evidence and executes approved commands.
- Business workflow owners: complete role-specific UAT.
- Finance/Inventory owners: verify balances, custody and open transactions.
- System administrator: verifies identity, roles and audit access.
- Release approver: authorizes production start, rollback or recovery.

No single operator should create, approve and validate a financial production
transaction used as deployment evidence.
