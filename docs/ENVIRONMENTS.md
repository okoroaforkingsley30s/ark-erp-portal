# Environment separation

ARK ONE uses explicit environment identity at application startup. Configuration
examples are stored under `config/environments`; their keys are public frontend
settings only and their blank values must be supplied by the target platform.

| Environment | `VITE_APP_ENV` | Supabase rule |
| --- | --- | --- |
| Local development | `development` | Localhost by default |
| Automated browser tests | `test` | Localhost only |
| CI build | `ci` | Non-operational placeholder allowed |
| Staging | `staging` | HTTPS and exact expected host required |
| Production | `production` | HTTPS and exact expected host required |

For staging and production, set `VITE_EXPECTED_SUPABASE_HOST` to the hostname from
the intended `VITE_SUPABASE_URL`. A mismatch stops the application before a
Supabase client is created. This prevents a staging build from silently using the
production database, and vice versa.

`VITE_ALLOW_REMOTE_DEVELOPMENT=true` is an explicit exception for development
against a dedicated remote test project. Never use it with the production URL.

The service-role key is forbidden in frontend configuration. Edge Function
secrets remain separate and must be configured in the corresponding Supabase
project. Environment files containing values are ignored by Git.

Build commands:

```bash
npm run build:staging
npm run build:production
```

The hosting platform must supply all required variables. A successful build does
not authorize deployment; the release gates in `docs/OPERATIONS-RUNBOOK.md` still
apply.
