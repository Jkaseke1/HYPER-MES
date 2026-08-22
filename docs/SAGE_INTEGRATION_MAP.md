# MES ↔ Sage Pastel Integration Map

**Live Sage DB:** `Hyperfeeds 2024`
**MES bridge project:** `C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES\bridge`
**Sage SDK API:** `C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES\sage-sdk-api`
**Mechanism:** MES DB triggers insert a row into `sync_log`. The MES bridge worker polls `sync_log` every 30 s, processes `pending` rows, posts to the local Sage SDK API at `http://127.0.0.1:5088`, and flips status to `success` or `failed`.

---

## 1. Event ⇒ Sage Effect Matrix

| MES Action | MES Tables Updated | `sync_log.event_type` | Sage Pastel Effect | Bridge Handler |
|---|---|---|---|---|
| **GRN approved** (received goods from supplier) | `goods_received_notes.status='approved'`, `grn_items`, `raw_materials.current_stock` ↑, `raw_material_lots` row created (one per `grn_item`) | `grn_confirmed` | Creates a Sage **purchase order + GRV receipt** using `PurchaseOrder.ProcessStock()`. Sage assigns the PO and configured `HFGRV` numbers; supplier invoice posting remains a Finance step. | `bridge/goodsReceiptAuto.js` |
| **Material Transfer received** (RM → Production) | `material_transfers.status='received'`, MES buffer/warehouse balances updated | `material_transfer_to_production` | Creates a **Warehouse Transfer** through the protected Sage SDK API. | `bridge/materialTransferSdkAuto.js` |
| **Production Issue** (issue ingredient to Production Order) | `production_order_materials.issued=true`, `raw_material_lots.qty_remaining` ↓ (FIFO), `stock_movements` (type=`consumption`), `raw_materials.current_stock` ↓ | `materials_issued` | Creates a **Inventory Journal / Goods Issue** on the raw-material stock item (debits WIP / COGS, credits stock). | `bridge/goodsIssueAuto.js` |
| **Production Completed** (batch finished, FG entered) | `production_orders.status='completed'`, `finished_goods_stock` ↑ (if wired) | `production_completed` | Creates an **Inventory Receipt** on the FG stock item (debits FG, credits WIP). | `bridge/batchCompleteAuto.js` |
| **Dispatch Delivered** (customer sales dispatch) | `dispatches.status='delivered'` | `dispatch_delivered` | Creates a **Customer Invoice** (AR document). Debits customer, credits FG stock + sales. | `bridge/dispatchAuto.js` |

> RM → Production material transfer now syncs to Sage through the local SDK API. Older direct bridge/SQL posting paths are fallback only.

---

## 2. Key Field Mappings

| MES Field | Sage Field | Used By |
|---|---|---|
| `suppliers.sage_code` | `SupplierMaster.Supplier` (account code, usually 6-char) | GRN → Supplier Invoice |
| `raw_materials.sage_code` | `StockMaster.Code` | GRN, Goods Issue |
| `formulations.sage_code` | `StockMaster.Code` (FG item) | Production Completed, Dispatch |
| `branches.sage_code` | Branch / Store code | All docs |

**If `sage_code` is blank on any record, the bridge will mark the sync_log row `failed` with a validation error.** Fix the missing code in MES, then re-queue by setting `sync_log.status='pending'`.

---

## 3. Triggers that Insert into `sync_log`

Defined in `supabase/migrations/20260328000002_create_bridge_triggers.sql`:

- `trg_grn_approved_sync` — on `goods_received_notes` status → `approved`
- `trg_materials_issued_sync` — on `production_order_materials.issued` flips to `true`
- `trg_production_completed_sync` — on `production_orders.status` → `completed`
- `trg_dispatch_delivered_sync` — on `dispatches.status` → `delivered`

No trigger on `stock_transfers` or `material_transfers` — by design.

---

## 4. Monitoring

```sql
-- pending / failed events
select id, event_type, status, payload->>'grn_number' as ref, error_message, created_at
from sync_log
where status in ('pending','failed','processing')
order by created_at desc
limit 50;

-- re-queue a failed event
update sync_log set status='pending', error_message=null, retry_count=0
where id = '<uuid>';
```

Bridge worker logs: run `npm start` in `C:\Users\Joseph Kaseke\CascadeProjects\HYPER MES\bridge`.

Sage SDK API health:

```powershell
Invoke-RestMethod http://127.0.0.1:5088/api/v1/health
```
