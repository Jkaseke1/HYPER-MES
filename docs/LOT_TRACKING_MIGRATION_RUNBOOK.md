# Lot-Tracking Migration Runbook

Apply these 3 migrations, in order, against the **Hyperfeeds 2024** Supabase project. Run each in the SQL Editor and wait for success before the next.

| # | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/20260422_rm_lot_tracking.sql` | Create `raw_material_lots`, triggers, backfill from opening balances + approved GRNs, create `v_rm_available_lots` view |
| 2 | `supabase/migrations/20260422_rm_lot_fifo_deplete.sql` | FIFO deplete helper, upgraded transfer trigger, one-time invariant reconciliation |
| 3 | `supabase/migrations/20260422_issue_ingredient_lot_decrement.sql` | Rewrite `issue_individual_ingredient` RPC to FIFO-deplete lots + emit stock movement |

---

## Pre-flight checks

```sql
-- must return 0
select count(*) from sync_log where status='processing' and created_at < now() - interval '10 minutes';

-- snapshot aggregate stock before migration
create table if not exists _rm_stock_snapshot_before as
select id, name, current_stock, now() as snap_at from raw_materials;
```

Pause the bridge worker during migration to avoid racing with the trigger swap (Ctrl+C on its terminal).

---

## Apply

Run each file's contents in the Supabase SQL editor. Each migration is **idempotent** — safe to re-run if you need to retry.

After file 1:
```sql
select count(*) as lot_count from raw_material_lots;
select count(*) from raw_material_lots where is_active=true;
```

After file 2 — invariant must be zero everywhere:
```sql
select rm.name, rm.current_stock,
       coalesce(sum(l.qty_remaining) filter (where l.is_active),0) as sum_lots,
       rm.current_stock - coalesce(sum(l.qty_remaining) filter (where l.is_active),0) as delta
from raw_materials rm
left join raw_material_lots l on l.raw_material_id = rm.id
group by rm.id
having rm.current_stock - coalesce(sum(l.qty_remaining) filter (where l.is_active),0) <> 0;
```
Expected: **0 rows**. If not, run the RECONCILE block at the bottom of migration 2 again.

After file 3:
```sql
-- confirm RPC was replaced
select prosrc from pg_proc where proname='issue_individual_ingredient';
-- should contain 'fifo_deplete_rm_lots'
```

---

## Smoke test end-to-end

1. **GRN:** capture a small GRN (e.g. 100 kg Maize) on a test supplier → Approve.
   - ✅ `raw_materials.current_stock` for Maize goes up by 100
   - ✅ new row in `raw_material_lots`
   - ✅ new row in `stock_movements` (type=`receipt`)
   - ✅ new row in `sync_log` (event_type=`grn_confirmed`, status=`pending`)

2. **Material Transfer:** transfer 20 kg of Maize, pick the GRN lot from step 1 → Approve.
   - ✅ lot `qty_remaining` = 80
   - ✅ `current_stock` unchanged (internal move)
   - ✅ `stock_movements` row (type=`transfer`)
   - ✅ no `sync_log` row (correct — internal event)

3. **Production Issue:** on a Production Order, click Issue on a Maize ingredient for 30 kg.
   - ✅ oldest Maize lot depleted by 30 (FIFO)
   - ✅ `current_stock` down by 30
   - ✅ `stock_movements` row (type=`consumption`)
   - ✅ `sync_log` row (event_type=`materials_issued`)

4. Resume bridge worker → both `sync_log` rows (GRN + Issue) should flip to `completed`.

---

## Rollback plan

Migration 1 creates a table; dropping it will lose lot history. Safer rollback = disable triggers, not drop:

```sql
alter table raw_material_lots disable trigger all;
alter table goods_received_notes disable trigger trg_grn_create_lots;
alter table stock_movements disable trigger trg_transfer_deplete_lots;
```

Then restore `current_stock` from the snapshot:
```sql
update raw_materials rm set current_stock = s.current_stock
from _rm_stock_snapshot_before s where s.id = rm.id;
```
