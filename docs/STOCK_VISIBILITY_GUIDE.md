# Where to See Stock After a GRN

A GRN is the only event that **creates** new raw-material stock. Once approved, the stock appears in **4 places** — each serves a different purpose.

---

## 1. Raw Materials list — aggregate `current_stock`

**Path:** `Raw Materials` page (sidebar).

Shows one row per raw material with the **total** quantity across all open lots.
Formula: `current_stock = SUM(raw_material_lots.qty_remaining WHERE is_active=true)`.

Use for: *"How much Maize do I have in total?"*

---

## 2. Stock by Batch drawer — per-lot detail

**Path:** Raw Materials page → click the **stack / batches** icon on any row.

Shows every active lot (one per GRN line), with:
- GRN number it came from
- Received date
- Original qty vs qty remaining
- Unit cost at receipt

Use for: *"Which GRN batch of Maize am I still consuming?"*, *"FIFO oldest lot?"*

Backing view: `public.v_rm_available_lots`.

---

## 3. Stock Movements report — history

**Path:** `Inventory → Stock Movements` (or query `stock_movements` table).

Every change to `qty_remaining` leaves a row here:
- `receipt` — from a GRN approval
- `transfer` — from a Material Transfer
- `consumption` — from a production issue
- `adjustment` — from a manual correction

Use for: *"Show me all movements of Maize this week"*, *"Audit trail for a lot"*.

---

## 4. SQL checks for stock-room / IT

```sql
-- live stock per raw material, per lot
select rm.name, l.lot_number, g.grn_number, l.qty_received, l.qty_remaining, l.received_date
from raw_material_lots l
join raw_materials rm on rm.id = l.raw_material_id
left join goods_received_notes g on g.id = l.grn_id
where l.is_active = true
order by rm.name, l.received_date;

-- invariant check (must be 0 for every material)
select rm.name,
       rm.current_stock as agg_stock,
       coalesce(sum(l.qty_remaining) filter (where l.is_active),0) as sum_lots,
       rm.current_stock - coalesce(sum(l.qty_remaining) filter (where l.is_active),0) as delta
from raw_materials rm
left join raw_material_lots l on l.raw_material_id = rm.id
group by rm.id
having rm.current_stock - coalesce(sum(l.qty_remaining) filter (where l.is_active),0) <> 0;
```

If the **invariant check** returns any rows, run the reconciliation migration `20260422_rm_lot_fifo_deplete.sql`.

---

## 5. Typical Post-GRN Walkthrough

1. Capture GRN on `Goods Received` page → **Approve**.
2. Immediately:
   - `raw_materials.current_stock` jumps by the received qty.
   - A new `raw_material_lots` row is inserted (one per GRN line item).
   - A `stock_movements` row (type `receipt`) is inserted.
   - A `sync_log` row (event_type `grn_confirmed`) is queued.
3. Within 30 s, bridge worker posts a **Supplier Invoice** to Sage.
4. The lot is now visible in:
   - Raw Materials list (aggregate)
   - Stock by Batch drawer (per lot)
   - Material Transfer "Source Batch" dropdown
   - Production Issue screen (FIFO candidate)
