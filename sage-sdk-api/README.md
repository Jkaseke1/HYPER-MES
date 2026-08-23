# HYPER MES Sage SDK API

Local .NET Framework API that wraps the Sage 200 Evolution SDK for HYPER MES.

## Runtime role

`bridge/bridgeWorker.js` watches MES `sync_log` rows and calls this API at:

```text
http://127.0.0.1:5088/api/v1
```

This keeps the stack API-first:

```text
MES approval -> MES bridge worker -> Sage SDK API -> Sage 200 Evolution
```

## Required Windows environment variables

Do not commit secrets. Set these on the machine that runs the API:

```text
HYPER_SAGE_API_KEY
HYPER_SAGE_SERVER
HYPER_SAGE_COMMON_DATABASE
HYPER_SAGE_COMPANY_DATABASE
HYPER_SAGE_SQL_USERNAME
HYPER_SAGE_SQL_PASSWORD
HYPER_SAGE_SDK_SERIAL
HYPER_SAGE_SDK_AUTH_CODE
```

The MES bridge `.env` must point to the same local API:

```text
SAGE_SDK_API_BASE_URL=http://127.0.0.1:5088
SAGE_SDK_API_KEY=<same value as HYPER_SAGE_API_KEY>
```

## Build

This repo tracks the API source and project file. The local machine must also have:

- `sage-sdk-api\packages\...` restored from `packages.config`
- `sage-sdk-api\vendor\Pastel.Evolution.11.0.0.10\Pastel.Evolution.dll`
- `sage-sdk-api\vendor\Pastel.Evolution.11.0.0.10\Pastel.Evolution.Common.dll`

Those package/vendor binaries are intentionally ignored by Git.

```powershell
& "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" `
  ".\sage-sdk-api\HyperMes.SageSdkApi\HyperMes.SageSdkApi.csproj" `
  /p:Configuration=Debug `
  /p:Platform=AnyCPU
```

## Start

```powershell
Start-Process `
  -FilePath ".\sage-sdk-api\HyperMes.SageSdkApi\bin\Debug\HyperMes.SageSdkApi.exe" `
  -WorkingDirectory ".\sage-sdk-api\HyperMes.SageSdkApi\bin\Debug" `
  -WindowStyle Hidden
```

## Health check

```powershell
Invoke-RestMethod http://127.0.0.1:5088/api/v1/health
```

## Current posted endpoints

- `POST /api/v1/warehouse-transfers/post`
- `POST /api/v1/goods-receipts/validate`
- `POST /api/v1/goods-receipts/post`
- `POST /api/v1/material-issues/validate`
- `POST /api/v1/material-issues/post`

GRV posting uses the legacy Sage `PostGRVV2` procedure to preserve the established standalone Goods Received Voucher workflow. The protected local API and MES bridge remain the only callers. The API assigns the next `HFGRV` number, verifies `DocType = 2`, and advances Sage's GRV sequence after a successful post.

Material issues use the public Evolution SDK `InventoryTransaction` API with `Operation = Decrease`, transaction code `MFDR`, and the Production (`PD`) warehouse. The API starts an SDK database transaction, validates every line against Sage warehouse stock and average cost, posts the package, then commits or rolls back the full SDK transaction.
