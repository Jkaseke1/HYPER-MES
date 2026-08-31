[CmdletBinding()]
param(
  [string]$BackupDirectory = 'D:\PlantControlBackups\Supabase',
  [string]$TaskName = 'PlantControl Daily Supabase Backup',
  [string]$Time = '01:15',
  [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this installer in an elevated PowerShell session on the production server.'
}

$scriptPath = Join-Path $PSScriptRoot 'backup-supabase.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "Backup script was not found: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute 'PowerShell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -BackupDirectory `"$BackupDirectory`" -RetentionDays $RetentionDays"
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Installed '$TaskName' to run daily at $Time."
