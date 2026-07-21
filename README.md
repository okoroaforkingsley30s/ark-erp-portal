# ARK ONE ERP Portal

ARK ONE is the internal enterprise operations platform for ARK Technologies
Group. It combines Helpdesk, Operations, Field Engineering, Inventory, Repair &
Refurbishment, Finance, Procurement, HR, Business Development, communication and
management reporting.

Built and maintained by **Okoroafor Kingsley Chukwuma**.

## Technology

- React 18 and Vite 6
- Supabase Auth, PostgreSQL, RLS, Storage, Realtime and Edge Functions
- TanStack Query and React Router
- Electron desktop and Capacitor Android targets
- Vitest and Playwright

## Safe local setup

Requirements: Node.js 22, npm and Docker Desktop.

```bash
npm ci
cp .env.example .env.local
npm run lint
npm run typecheck
npm test
npm run build
```

Set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend local
environment. Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_*` variable.

The original repository did not contain a complete baseline for pre-existing
operational tables. Before running `supabase db reset`, follow
[Local Supabase Testing](docs/LOCAL-SUPABASE-TESTING.md) and provide the required
schema-only baseline. Use `scripts/export-production-schema.ps1` for the
read-only export and do not use production data.

## Verification commands

```bash
npm run validate:migrations
npm run validate:security-headers
npm run validate:electron
npm run validate:android
npm run lint
npm run typecheck
npm run test:coverage
npm run test:integration
npm run test:e2e
npm audit --audit-level=high
npm run build
```

Integration tests require local Supabase or a dedicated test project. They refuse
remote targets unless explicitly enabled. Browser tests use local placeholder
configuration and never connect to production by default.

## Documentation

- [Operations Runbook](docs/OPERATIONS-RUNBOOK.md) — roles, migrations,
  deployment, rollback and recovery
- [Environment Separation](docs/ENVIRONMENTS.md) — development, staging and
  production configuration guards
- [Web Security](docs/WEB-SECURITY.md) — CSP, hosting headers and allowed browser
  capabilities
- [Desktop Packaging](docs/DESKTOP-PACKAGING.md) — Electron development,
  production testing and Windows installer creation
- [Android Release](docs/ANDROID-RELEASE.md) — backup policy, signing, shrinking,
  versioning and Play release procedure
- [Local Supabase Testing](docs/LOCAL-SUPABASE-TESTING.md) — Docker-based release
  candidate validation
- [Browser Journey Tests](tests/e2e/README.md)
- [Supabase Integration Tests](tests/integration/README.md)
- [Main Branch Protection](.github/BRANCH_PROTECTION.md)

## Production rule

No migration, function or frontend release may be applied to the live ARK ONE
environment until the Docker migration reset, automated gates and user acceptance
checklist pass against an isolated environment and a recoverable backup exists.
