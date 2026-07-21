$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker was not found. Install and start Docker Desktop first.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Desktop is installed but its engine is not running.'
}

$baseline = Join-Path $root 'supabase\migrations\202606300000_production_schema_baseline.sql'
if (-not (Test-Path -LiteralPath $baseline)) {
  throw @'
The production schema baseline is missing.
Create the schema-only baseline before resetting Docker:
  supabase\migrations\202606300000_production_schema_baseline.sql
Do not use production data and do not continue with an incomplete schema.
'@
}

$baselineText = Get-Content -LiteralPath $baseline -Raw
foreach ($requiredTable in @('part_requests', 'repair_jobs', 'spare_parts', 'tickets')) {
  if ($baselineText -notmatch "(?i)create\s+table[^;]*\b$requiredTable\b") {
    throw "The baseline does not define required table: $requiredTable"
  }
}

Write-Host 'Starting isolated Supabase containers...'
& npx supabase start
if ($LASTEXITCODE -ne 0) { throw 'supabase start failed.' }

Write-Host 'Rebuilding the local database from all migrations...'
& npx supabase db reset
if ($LASTEXITCODE -ne 0) { throw 'Migration reset failed. Production was not touched.' }

$statusLines = & npx supabase status -o env
if ($LASTEXITCODE -ne 0) { throw 'Unable to read local Supabase credentials.' }

$values = @{}
foreach ($line in $statusLines) {
  if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') {
    $values[$matches[1]] = $matches[2].TrimEnd('"')
  }
}

$apiUrl = $values['API_URL']
$anonKey = if ($values['ANON_KEY']) { $values['ANON_KEY'] } else { $values['PUBLISHABLE_KEY'] }
$serviceKey = if ($values['SERVICE_ROLE_KEY']) { $values['SERVICE_ROLE_KEY'] } else { $values['SECRET_KEY'] }
if (-not $apiUrl -or -not $anonKey -or -not $serviceKey) {
  throw 'Local API URL or test keys were not returned by Supabase.'
}

$env:SUPABASE_TEST_URL = $apiUrl
$env:SUPABASE_TEST_ANON_KEY = $anonKey
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = $serviceKey
Remove-Item Env:ARK_ALLOW_REMOTE_INTEGRATION_TESTS -ErrorAction SilentlyContinue

Write-Host 'Running database, Auth, RLS, Storage and rollback integration tests...'
$edgeEnv = Join-Path $env:TEMP 'ark-one-local-functions.env'
$edgeLog = Join-Path $env:TEMP 'ark-one-local-functions.log'
Set-Content -LiteralPath $edgeEnv -Encoding utf8 -Value @(
  'GOOGLE_CLIENT_ID=local-test-client'
  'GOOGLE_CLIENT_SECRET=local-test-secret'
  'GOOGLE_REDIRECT_URI=http://127.0.0.1:54321/functions/v1/gmail-oauth'
  'GMAIL_OAUTH_STATE_SECRET=local-test-state-secret-not-for-production'
  'PASSWORD_SETUP_REDIRECT_URL=http://127.0.0.1:5173/#/create-password'
)

$edgeEnvContent = Get-Content -LiteralPath $edgeEnv -Raw
[System.IO.File]::WriteAllText(
  $edgeEnv,
  $edgeEnvContent,
  [System.Text.UTF8Encoding]::new($false)
)
$edgeProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList @(
  '/d', '/s', '/c',
  "npx supabase functions serve --env-file `"$edgeEnv`" > `"$edgeLog`" 2>&1"
) -WindowStyle Hidden -PassThru

try {
  Start-Sleep -Seconds 6
  if ($edgeProcess.HasExited) {
    throw "Local Edge Functions failed to start. Review: $edgeLog"
  }
  & npm run test:integration
  if ($LASTEXITCODE -ne 0) { throw "Local Supabase integration tests failed. Edge log: $edgeLog" }
} finally {
  if ($edgeProcess -and -not $edgeProcess.HasExited) {
    Stop-Process -Id $edgeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $edgeEnv -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Local Supabase validation passed.' -ForegroundColor Green
Write-Host "Studio: $($values['STUDIO_URL'])"
Write-Host "API: $apiUrl"
Write-Host 'No production database was modified.'
