# Main branch protection

Branch protection is installed only after the repaired repository is pushed and
GitHub has completed the first CI and secret-scanning runs. This prevents `main`
from being locked against checks that do not yet exist remotely.

Use a short-lived GitHub token with **Administration: write** access. Do not save
the token in this repository or an `.env` file.

PowerShell:

```powershell
$env:GITHUB_TOKEN = 'short-lived-token'
npm run configure:branch-protection
Remove-Item Env:GITHUB_TOKEN
```

The installer is locked to `okoroaforkingsley30s/ark-erp-portal` and `main`. It
requires branches to be up to date and requires these checks:

- Build, lint, types, tests and audit
- Browser journeys
- Supabase integration tests (optional test project)
- Gitleaks history scan

It also applies protection to administrators, blocks force pushes and deletion,
and requires pull-request conversations to be resolved. It does not require a
second reviewer, so a single-maintainer repository is not locked out.
