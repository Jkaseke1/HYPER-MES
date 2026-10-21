# TEST automatic read budgets

Applied to the HYPER-MES TEST repository only, not HYPER-MES-PRODUCTION.
No database permissions, costing, packaging, stock movements or manufacturing
writes are changed.

| Screen/work | Automatic interval |
| --- | --- |
| Material transfer and both warehouse screens | 60 seconds |
| Production order list | 60 seconds |
| Pending/processing Sage issue, completion and finalization detail | 30 seconds |
| GRN Sage statuses and active stock takes | 60 seconds |
| Header receiving/queue summaries and stock-take freeze banner | 60 seconds |
| Daily production report, Sage posting review and sync logs | 120 seconds |
| Full dashboard | 300 seconds |
| Shared Realtime-refresh pages | At least 60 seconds between automatic reads |

Timers stop sending automatic reads while hidden, offline or in backend
cooldown. Sequential scheduling prevents timer overlaps. Dashboard, transfer,
warehouse and report Realtime invalidations share the timer's rate budget.
Production order list invalidations share a last-read timestamp with polling.
Manual refresh, initial page loads, filters and action-triggered reconciliation
remain immediate. Event payload notifications do not need an extra query to
show a Sage status change. Closed stock takes stop polling.

For material transfers, six initial reads plus an optional sync-log read now
run at most once/minute automatically, instead of once/three seconds. That is
about 7 rather than 140 scheduled HTTP reads/minute/tab (95% reduction).
Each HTTP request can still perform multiple SQL operations through joins,
policies or triggers. Counts exclude initial/manual/action reads.

These are per-mounted-screen budgets, not a project-wide quota: users, tabs,
manual actions, imports and administration still multiply demand. This does
not promise that Nano resources cannot be exhausted. Heavy history queries
still need pagination/summary projections as the dataset grows. No historical
rows are silently discarded by adding an arbitrary LIMIT in this change.

The root bridge already has adaptive TEST polling saved (15 seconds active,
up to 60 seconds idle, up to five minutes on errors). An old running process
must be restarted in a controlled way to load it. This frontend change does
not stop or replay bridge jobs.

Verification: `node scripts/test-backend-load.cjs`, production build, and a
TypeScript diagnostic comparison against HEAD. The repository already has
unrelated type errors, so a build is not a claim of a clean full typecheck.
Budget tests use fixtures and send no Supabase or Sage requests.
