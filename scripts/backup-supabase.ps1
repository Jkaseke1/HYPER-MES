[CmdletBinding()]
param(
  [string]$BackupDirectory = 'D:\PlantControlBackups\Supabase',
  [int]$RetentionDays = 30,
  [string]$SupabaseCli = 'supabase'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$databaseUrl = [Environment]::GetEnvironmentVariable('SUPABASE_DB_URL', 'Machine')
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw 'SUPABASE_DB_URL is not configured as a machine environment variable.'
}

if (-not (Get-Command $SupabaseCli -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI '$SupabaseCli' was not found in PATH."
}

New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDirectory = Join-Path $BackupDirectory "work-$stamp"
$archivePath = Join-Path $BackupDirectory "plantcontrol-supabase-$stamp.zip"
$checksumPath = "$archivePath.sha256"

New-Item -ItemType Directory -Path $workDirectory -Force | Out-Null

try {
  $schemaPath = Join-Path $workDirectory 'schema.sql'
  $dataPath = Join-Path $workDirectory 'data.sql'
  $rolesPath = Join-Path $workDirectory 'roles.sql'
  $metadataPath = Join-Path $workDirectory 'backup.json'

  & $SupabaseCli db dump --db-url $databaseUrl --role-only --file $rolesPath
  if ($LASTEXITCODE -ne 0) { throw "Role dump failed with exit code $LASTEXITCODE." }

  & $SupabaseCli db dump --db-url $databaseUrl --file $schemaPath
  if ($LASTEXITCODE -ne 0) { throw "Schema dump failed with exit code $LASTEXITCODE." }

  & $SupabaseCli db dump --db-url $databaseUrl --data-only --use-copy --file $dataPath
  if ($LASTEXITCODE -ne 0) { throw "Data dump failed with exit code $LASTEXITCODE." }

  [pscustomobject]@{
    created_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    source = 'PlantControl Supabase PostgreSQL'
    roles_file = 'roles.sql'
    schema_file = 'schema.sql'
    data_file = 'data.sql'
  } | ConvertTo-Json | Set-Content -Path $metadataPath -Encoding UTF8

  Compress-Archive -Path (Join-Path $workDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal -Force
  (Get-FileHash -Path $archivePath -Algorithm SHA256).Hash | Set-Content -Path $checksumPath -Encoding ASCII
}
finally {
  Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Get-ChildItem -Path $BackupDirectory -File |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force
