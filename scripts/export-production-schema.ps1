param(
  [string]$DatabaseHost,
  [int]$DatabasePort = 5432,
  [string]$DatabaseName = 'postgres',
  [string]$DatabaseUser,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$migrationDirectory = Join-Path $root 'supabase\migrations'
$output = Join-Path $migrationDirectory '202606300000_production_schema_baseline.sql'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker was not found. Install and start Docker Desktop first.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Desktop is installed but its engine is not running.'
}

if (-not $DatabaseHost) {
  $DatabaseHost = Read-Host 'Production database host (for example db.PROJECT_REF.supabase.co)'
}
if (-not $DatabaseUser) {
  $DatabaseUser = Read-Host 'Production database user (usually postgres)'
}
if (-not $DatabaseHost -or -not $DatabaseUser) {
  throw 'Database host and user are required.'
}
if ((Test-Path -LiteralPath $output) -and -not $Force) {
  throw "Baseline already exists: $output. Use -Force only after reviewing the existing file."
}

Write-Host ''
Write-Host 'This performs a read-only schema export of the public schema.' -ForegroundColor Yellow
Write-Host 'It does not export production rows and does not alter production.' -ForegroundColor Yellow
$confirmation = Read-Host 'Type EXPORT to continue'
if ($confirmation -cne 'EXPORT') {
  throw 'Schema export cancelled.'
}

$securePassword = Read-Host 'Production database password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $mount = "${migrationDirectory}:/output"

  & docker run --pull=missing --rm `
    -e PGPASSWORD `
    -v $mount `
    postgres:17 `
    pg_dump `
    --host=$DatabaseHost `
    --port=$DatabasePort `
    --username=$DatabaseUser `
    --dbname=$DatabaseName `
    --schema=public `
    --schema-only `
    --no-owner `
    --no-privileges `
    --file=/output/202606300000_production_schema_baseline.sql

  if ($LASTEXITCODE -ne 0) {
    throw 'pg_dump failed. No Docker database reset was attempted.'
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}

$baseline = Get-Content -LiteralPath $output -Raw
# Stored-function definitions can legitimately contain INSERT statements. Real
# pg_dump table-data sections have the marker below or a top-level COPY command.
if ($baseline -match '(?im)^--\s+Data for Name:' -or
    $baseline -match '(?im)^COPY\s+(?:public\.)?[^\s(]+\s*\(') {
  Remove-Item -LiteralPath $output -Force
  throw 'The export unexpectedly contains row data and was deleted.'
}

foreach ($requiredTable in @('part_requests', 'repair_jobs', 'spare_parts', 'tickets')) {
  if ($baseline -notmatch "(?i)create\s+table[^;]*\b$requiredTable\b") {
    throw "Export completed but required table was not found: $requiredTable"
  }
}

Write-Host ''
Write-Host 'Schema-only baseline created successfully:' -ForegroundColor Green
Write-Host $output
Write-Host 'Review it for structure only before running the local Supabase test.'
