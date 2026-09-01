# September 2026 Opening Stock Cutover

## Purpose

Establish PlantControl's September opening stock from the Finance-approved
physical count at the close of business on 31 August 2026. This procedure does
not delete PlantControl records and does not write inventory adjustments to
Sage automatically.

## Non-negotiable controls

- Do not run `DELETE`, `TRUNCATE`, reset scripts, or a database restore.
- Do not start the normal bridge worker with an unrestricted event scope during
  the cutover.
- Do not process GRNs, weighbridge tickets, material transfers, production
  issues, or dispatches until Finance signs the reconciliation.
- Do not use a partial Sage snapshot as an opening balance.
- Keep the Sage SDK API and bridge on the production application server only.

## What "clear for September" means

It means operational activity begins after the approved opening snapshot. It
does not mean deleting history. Existing GRNs, stock movements, audit records,
users, master data, and Sage transaction references remain intact. Test and
draft records are retained for audit and explicitly excluded from the approved
opening reconciliation.

## Production user accounts

Production uses the real staff accounts, but they are created afresh in the
Production Supabase project. Do not copy `auth.users`, password hashes, or UAT
user UUIDs. New Production user IDs prevent any UAT record relationship from
being carried into Production.

For each approved staff member, retain only the operational access definition:

- full name and work email
- PlantControl role or roles
- branch access and access level
- active or inactive status

After the clean Production schema is installed, create the first Production
administrator, verify that their profile and administrator role are linked,
then invite or create the remaining staff accounts. Every user sets a new
Production password or receives a password-reset invitation. Do not create
users before the schema bootstrap, because the `profiles` and role-assignment
automation will not exist yet.

## Cutover roles

| Role | Responsibility |
| --- | --- |
| Finance | Certify the physical count, approve each variance, and post any Sage stock adjustment. |
| Warehouse | Stop movements during the count window and verify all counted items. |
| PlantControl administrator | Run backups, control bridge scope, capture the Sage baseline, and record evidence. |
| Sage administrator | Confirm the Sage company, period, warehouse, and final adjustment reports. |

## 1. Pre-cutover evidence

Complete and retain all of the following before touching the production workflow:

1. Confirm the Sage company is the intended production company and the current period is September 2026.
2. Export Sage RM warehouse (`RM`) stock-on-hand and valuation reports as at 31 August close.
3. Export the Finance physical-count workbook with item code, item description, counted quantity, unit, count sheet reference, variance reason, and approver.
4. Verify the latest Supabase managed backup or a tested independent backup. Follow `docs/supabase-backup-runbook.md`.
5. Export the PlantControl reconciliation and pending Sage-posting lists.
6. Stop the unrestricted bridge worker before the cutover window starts.

## 2. Resolve Sage item exceptions first

The opening snapshot is blocked until every active RM item can be read from the
Sage SDK. The UAT exceptions observed on 1 September were:

- `BFP(FM)`
- `77`
- `79`
- `PAS00025`
- `DAI40`

For each exception, Finance and the Sage administrator must confirm whether it
is an active stocked RM item, an obsolete code, a duplicate, or a mapping
problem. Correct the approved mapping or formally retire the item from the
active RM catalogue. Never silently omit an active stocked item.

## 3. Controlled live Sage refresh

The opening snapshot is a read from Sage plus an auditable PlantControl
baseline. It does not change Sage quantities.

From PowerShell on the production application server:

```powershell
cd "C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES"
.\sage-sdk-api\Start-SageSdkApi.ps1
Invoke-RestMethod http://127.0.0.1:5088/api/v1/health

cd .\bridge
$env:BRIDGE_ALLOWED_EVENT_TYPES = 'stock_take_sage_snapshot'
node .\bridgeWorker.js
```

This allow-list is critical. It permits the bridge to process only the opening
stock snapshot request. Do not set `DRY_RUN=true` for this live snapshot: a
dry-run bridge can mark an event as handled even though its Sage transaction
was deliberately skipped. The stock snapshot itself is read-only against Sage.

In PlantControl, start one stock take titled:

`September 2026 Opening Stock - 31 August Close`

Use the Finance owner as the responsible person. Do not enter counts or freeze
the take until the page states that the live Sage snapshot is complete and
shows every intended RM line.

## 4. Reconcile and approve

1. Enter or import the Finance physical count against the live Sage baseline.
2. Investigate every variance. A zero variance is still reviewed; it is not
   assumed correct automatically.
3. Finance approves each adjustment decision.
4. Any inventory adjustment is posted in Sage by Finance, using the approved
   Sage process and reference. PlantControl does not post the adjustment.
5. Run a final Sage RM stock refresh after Finance posts the adjustments.
6. Confirm the final PlantControl baseline equals the Sage RM report and the
   approved physical-count reconciliation.

## 5. Release September operations

Release only when all gates are true:

- The snapshot status is `READY` with a complete line count.
- Finance has signed the reconciliation.
- There are no unapproved variances.
- The final Sage RM report and PlantControl opening balance agree.
- Pending production, GRN, transfer, and dispatch events have been reviewed.

Then stop the restricted bridge (`Ctrl+C`), clear the PowerShell session
allow-list, and start the normal bridge only with the event types formally
approved for rollout. For example, to activate GRN only:

```powershell
Remove-Item Env:BRIDGE_ALLOWED_EVENT_TYPES -ErrorAction SilentlyContinue
$env:BRIDGE_ALLOWED_EVENT_TYPES = 'grn_confirmed'
node .\bridgeWorker.js
```

Do not leave the event scope blank until every Sage workflow has been approved
for production.

## Rollback

If a gate fails, stop the bridge and keep September postings paused. Preserve
the failed snapshot, logs, exports, and Finance worksheet for investigation.
Do not delete records and do not restore the production database simply to
restart the count. Resume only after the discrepancy is understood and an
authorized corrective action is approved.
