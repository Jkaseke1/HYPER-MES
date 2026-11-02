# PlantControl packaging costing

Apply `supabase/migrations/20261102120000_production_packaging_cost.sql` before
deploying the updated production-order screen. It adds `packaging_cost` to order
cost metadata and a Finance-only RPC to set packaging unit costs on open orders.
It does not backfill completed orders, seed prices, or change inventory balances.

Finance enters a verified USD price per packaging unit in the order's Packaging
section. It is saved when the field loses focus. The RPC checks the authenticated
profile role, locks the order, and blocks price changes once a completion event
exists. Existing unpriced packaging appears as Not costed and blocks completion.

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
