$ErrorActionPreference = "Stop"

$apiExe = Join-Path $PSScriptRoot "HyperMes.SageSdkApi\bin\Debug\HyperMes.SageSdkApi.exe"
$apiDir = Split-Path $apiExe -Parent

if (-not (Test-Path $apiExe)) {
  throw "SDK API executable not found. Run sage-sdk-api\Build-SageSdkApi.ps1 first."
}

Start-Process `
  -FilePath $apiExe `
  -WorkingDirectory $apiDir `
  -WindowStyle Hidden

Start-Sleep -Seconds 1
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:5088/api/v1/health"
