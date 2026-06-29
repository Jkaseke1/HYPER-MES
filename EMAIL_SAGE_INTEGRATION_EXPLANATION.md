# Email: Understanding Current Manual Process vs. HYPER-MES Integration

---

**To:** Production Team (Mano, Chamu, Kudzi, Archfold)  
**From:** Joseph Kaseke  
**Subject:** Understanding Current Sage Posting Process for HYPER-MES Integration  
**Date:** June 29, 2026

---

Dear Team,

As we prepare for the HYPER-MES go-live in August 2028, I need to understand the **current manual process** for posting manufacturing data into Sage Pastel so we can replicate it accurately in the automated system.

## What I Need to Understand

### 1. **Goods Received Notes (GRN)**
**Current Manual Process:**
- When raw materials are received, where do you post this in Sage?
- Which Sage module/screen do you use? (e.g., Inventory → Goods Received)
- Which warehouse code do you post to? (We assume WhseID=18 for Raw Materials)
- What reports do you generate from this data?

**HYPER-MES Automated Process:**
- When a GRN is created in MES, the bridge worker will automatically:
  - Post journal line to `_etblInvJrBatchLines`
  - Update `QtyOnHand` in `_etblStockQtys` (WhseID=18)
  - Update average cost in `WhseStk`

---

### 2. **Material Issuance to Production**
**Current Manual Process:**
- When materials are issued to a production batch, where do you post this in Sage?
- Do you use a Work Order number or Batch number as reference?
- Which warehouse does the stock come from? (We assume WhseID=18)
- What reports do you generate to track material usage?

**HYPER-MES Automated Process:**
- When materials are issued in MES, the bridge worker will automatically:
  - Post journal line with `fQtyOut` (negative quantity)
  - Decrement `QtyOnHand` in WhseID=18
  - Reference: `WO-{batch_number}`

---

### 3. **Production Batch Completion (Finished Goods Receipt)**
**Current Manual Process:**
- When a production batch is completed, where do you post the finished goods in Sage?
- Which warehouse do you post to? (We assume WhseID=20 for Despatch/FG)
- How do you calculate the cost per unit?
- What reports do you generate to track production output?

**HYPER-MES Automated Process:**
- When a batch is completed in MES, the bridge worker will automatically:
  - Post FG receipt to `_etblInvJrBatchLines`
  - Update `QtyOnHand` in WhseID=20 (Despatch Warehouse)
  - Calculate cost per unit from material costs
  - Reference: `WO-{batch_number}`

---

### 4. **Dispatch to Branches**
**Current Manual Process:**
- When finished goods are dispatched to branches, where do you post this in Sage?
- Do you use a two-step transfer (Despatch → Branch)?
- Which branch warehouse codes do you use?
- What reports do you generate for dispatch tracking?

**HYPER-MES Automated Process:**
- When a dispatch order is marked as dispatched in MES, the bridge worker will automatically:
  - Post two journal lines (transfer out from WhseID=20, transfer in to branch warehouse)
  - Update `QtyOnHand` for both warehouses
  - Reference: `DSP-{dispatch_number}`

---

### 5. **Macropack Manufacturing**
**Current Manual Process:**
- When macropacks (premixes) are manufactured, where do you post this in Sage?
- Which warehouse do you post to?
- How do you track ingredient consumption?

**HYPER-MES Automated Process:**
- When a macropack order is completed in MES, the bridge worker will automatically:
  - Post macropack receipt to Sage
  - Update `QtyOnHand` for the macropack
  - Reference: `MP-{order_number}`

---

### 6. **Monthly Reconciliation Variances**
**Current Manual Process:**
- When you do monthly stock reconciliation and find variances, where do you post adjustments in Sage?
- Which transaction code do you use?
- What reports do you generate?

**HYPER-MES Automated Process:**
- When reconciliation variances are approved in MES, the bridge worker will automatically:
  - Post adjustment journal lines
  - Update `QtyOnHand` for affected materials

---

### 7. **Raw Material Cost Updates**
**Current Manual Process:**
- When raw material costs change, where do you update this in Sage?
- Do you update `fExclCost` in the Stock Item master?

**HYPER-MES Automated Process:**
- When RM costs are updated in MES (RM Prices page), the bridge worker will automatically:
  - Update `fExclCost` in `StkItem` table

---

## What I Need From You

Please provide:

1. **Screenshots** of the Sage screens you currently use for each process above
2. **Sample reports** you generate from Sage for each process
3. **Warehouse codes** you use for each transaction type
4. **Transaction codes** (iTrCodeID) you use in Sage
5. **Any special rules** or calculations you apply manually

This information will help me ensure that:
- ✅ HYPER-MES posts data to the **exact same tables** as your manual process
- ✅ You can generate the **exact same reports** from Sage after go-live
- ✅ No data is lost or duplicated during the transition
- ✅ The automated process matches your current workflow

---

## Timeline

Please provide this information by **[DATE]** so we can:
1. Verify the bridge integration is posting correctly
2. Test report generation with automated data
3. Train the team on the new system before go-live

---

## Questions?

If you have any questions or need clarification on any of the above, please let me know.

Thank you for your cooperation!

Best regards,  
**Joseph Kaseke**  
HYPER-MES Project Lead

---

## Attachment: Current vs. Automated Process Summary

| Process | Current Manual Entry | HYPER-MES Automated | Sage Table | Warehouse |
|---------|---------------------|---------------------|------------|-----------|
| GRN | Manual entry in Sage Inventory | Auto-posted from MES GRN | `_etblInvJrBatchLines` | WhseID=18 (RM) |
| Material Issue | Manual entry in Sage | Auto-posted from MES material issue | `_etblInvJrBatchLines` | WhseID=18 (RM) |
| Batch Complete | Manual entry in Sage | Auto-posted from MES batch completion | `_etblInvJrBatchLines` | WhseID=20 (FG) |
| Dispatch | Manual entry in Sage | Auto-posted from MES dispatch | `_etblInvJrBatchLines` | WhseID=20 → Branch |
| Macropack | Manual entry in Sage | Auto-posted from MES macropack | `_etblInvJrBatchLines` | TBD |
| Reconciliation | Manual adjustment in Sage | Auto-posted from MES reconciliation | `_etblInvJrBatchLines` | WhseID=18 (RM) |
| Cost Update | Manual update in Sage | Auto-posted from MES RM Prices | `StkItem.fExclCost` | N/A |

