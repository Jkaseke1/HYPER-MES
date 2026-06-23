# Test Data Reset Confirmation

## ✅ CONFIRMED: What Gets Reset to ZERO

### 1. **Goods Received Notes (GRNs)**
- ✅ All GRN records deleted
- ✅ All GRN items deleted
- ✅ All quality inspections deleted
- **Result:** Start fresh - no receiving history

### 2. **Raw Material Warehouse Stocks**
- ✅ All `raw_material_lots` deleted (this is what drives stock)
- ✅ All `raw_materials.current_stock` set to **ZERO**
- **Result:** All RM warehouse stocks = 0.00

### 3. **Stock Takes**
- ✅ All stock take records deleted
- ✅ All stock take lines deleted
- ✅ All stock take audit logs deleted
- **Result:** No stock take history

### 4. **Stock Movements**
- ✅ All stock movement records deleted
- **Result:** Clean audit trail starts after reset

### 5. **Production Orders**
- ✅ All production orders deleted
- ✅ All production logs deleted
- ✅ All material issues deleted
- **Result:** No production history

### 6. **Dispatch Orders**
- ✅ All dispatch orders deleted
- ✅ All dispatch items deleted
- **Result:** No dispatch history

### 7. **Chick Management**
- ✅ All chick POs deleted
- ✅ All consignments deleted
- ✅ All delivery notes deleted
- ✅ All invoices deleted
- **Result:** Clean chick module

---

## ✅ TESTING WORKFLOW AFTER RESET

### Step 1: Verify Zero Stock
```sql
SELECT code, name, current_stock, unit
FROM raw_materials
ORDER BY code;
```
**Expected:** All `current_stock` = 0

### Step 2: Create GRN
- Create new GRN with materials
- Accountant approves GRN
- **Expected:** Stock increases from 0 to received quantity

### Step 3: Check RM Warehouse
- Navigate to RM Warehouse page
- **Expected:** Stock shows the received quantities from GRN

### Step 4: Verify Stock Movement
- Check stock movements table
- **Expected:** Shows GRN receipt movement

---

## 🔒 PRESERVED (Not Reset)

### Master Data:
- ✅ Raw Materials (definitions, not stock)
- ✅ Suppliers
- ✅ Branches
- ✅ Warehouses
- ✅ Machines
- ✅ Formulations
- ✅ User Profiles

### Why Preserved?
These are configuration/setup data that don't change between tests.

---

## 📋 HOW TO RUN RESET

### Method 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Open the file: `99999999_reset_test_data.sql`
5. Click **"Run"**
6. Check verification queries at the end

### Method 2: Copy-Paste
1. Open `supabase/migrations/99999999_reset_test_data.sql`
2. Copy entire contents
3. Paste in Supabase SQL Editor
4. Click **"Run"**

---

## ⚠️ IMPORTANT NOTES

1. **This is IRREVERSIBLE** - All transactional data will be permanently deleted
2. **Backup first** if you need to preserve any data
3. **All stocks will be ZERO** after reset
4. **Test in staging first** before running in production
5. **Coordinate with team** - ensure no one is actively using the system

---

## ✅ POST-RESET VERIFICATION CHECKLIST

After running the reset script, verify:

- [ ] All GRN count = 0
- [ ] All Production Orders count = 0
- [ ] All Dispatch Orders count = 0
- [ ] All Stock Movements count = 0
- [ ] All Stock Takes count = 0
- [ ] All Raw Material Lots count = 0
- [ ] All Chick POs count = 0
- [ ] **All raw material current_stock = 0**

Run this query to verify:
```sql
-- Should return 0 for all tables
SELECT 
  'GRNs' as table_name, COUNT(*) as count FROM goods_received_notes
UNION ALL
SELECT 'Production Orders', COUNT(*) FROM production_orders
UNION ALL
SELECT 'Stock Movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'Stock Takes', COUNT(*) FROM stock_takes
UNION ALL
SELECT 'Raw Material Lots', COUNT(*) FROM raw_material_lots
ORDER BY table_name;

-- Should return NO rows (all stocks are zero)
SELECT code, name, current_stock
FROM raw_materials
WHERE current_stock != 0;
```

---

## 🎯 READY FOR TESTING

After reset, you can:
1. Create fresh GRNs
2. Verify stock increases in RM Warehouse
3. Test production with clean data
4. Test dispatch with clean data
5. Verify all workflows from scratch

**All stock tracking will work correctly from ZERO baseline!**
