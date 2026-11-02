# PlantControl packaging costing

Apply `supabase/migrations/20261102120000_production_packaging_cost.sql` before
deploying the updated production-order screen. It adds `packaging_cost` to order
cost metadata and a Finance-only RPC to set packaging unit costs on open orders.
It does not backfill completed orders, seed prices, or change inventory balances.

Apply `20261102140000_automatic_packaging_cost.sql` after the initial migration.
Packaging unit costs load from the matching active raw material's cost_per_unit,
the same master used for ingredient issues. Existing snapshots are retained;
reconciled Sage issue costs in successful sync_log details.postedComponents take
priority. The screen displays the cost as a read-only value, with Awaiting cost
sync when no supported price is available. There is no manual price entry.
New snapshots resolve their price automatically, and actual-use updates capture
the resolved cost. The migration does not backfill completed orders or balances.
The SDK bridge must publish reconciled postedComponents for the posted-cost
override to work; the master-cost estimate works without that bridge update.

The screen shows ingredients, packaging, labour and overhead separately.
Completion snapshots packaging cost from the declared bags used and saved unit
prices, then includes it in `total_cost` and the managerial per-kg cost. Overhead
retains its existing ingredient-only basis. Completed orders display their saved
total and packaging cost instead of recalculating historical totals.

The separate SDK bridge values Sage receipts from actual Sage component issues;
this managerial-cost change does not add another packaging issue or send overhead
to Sage. For 20 PAL0050 bags at 0.349, packaging is 6.98. With 474.932 ingredients
and 23.75 overhead, the managerial total is 505.662 (505.66 rounded).

Validation: `node scripts/test-production-packaging-cost.cjs` checks planned vs
actual use, actual declarations, missing costs, and the example total. Database
role guards and UI behavior require UAT validation after applying the migration.
