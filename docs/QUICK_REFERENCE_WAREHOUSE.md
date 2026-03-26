# 🚚 Warehouse & Dispatch Team - Quick Reference

## Daily Tasks

### Check Stock Levels
1. Go to **Warehouse** page
2. View **Stock Overview** tab
3. KPI cards show:
   - Total Raw Materials Value
   - Total Finished Goods
   - Low Stock Items
   - Warehouse Count

### Monitor Stock Movements
1. Go to **Stock Movements** tab
2. Filter by:
   - Date range
   - Movement type (In/Out)
   - Warehouse
3. Track all material flows

---

## Dispatch Orders

### Create Dispatch
1. **Dispatch Orders** → **+ New Dispatch**
2. Select **Branch** destination
3. Add products:
   - Select product
   - Enter quantity
4. Assign **Vehicle** and **Driver**
5. Submit

### Update Dispatch Status
1. Find dispatch in list
2. Click to open
3. Update status as order progresses:
   - Pending → Loading → Dispatched → In Transit → Delivered

---

## Dispatch Workflow

```
┌─────────┐   ┌─────────┐   ┌────────────┐   ┌───────────┐   ┌───────────┐
│ Pending │ → │ Loading │ → │ Dispatched │ → │ In Transit│ → │ Delivered │
└─────────┘   └─────────┘   └────────────┘   └───────────┘   └───────────┘
     ↓            ↓              ↓                ↓               ↓
  Created     Loading        Left depot       On the way      Completed
              goods
```

---

## Stock Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green bar (full) | Stock healthy |
| 🟡 Yellow bar (partial) | Getting low |
| 🔴 Red bar (empty) | Critical/Out |

---

## Movement Types

| Type | Direction | Example |
|------|-----------|---------|
| GRN Receipt | IN | Raw materials received |
| Production Input | OUT | Materials to production |
| Production Output | IN | Finished goods from production |
| Dispatch | OUT | Goods sent to branch |
| Transfer | IN/OUT | Between warehouses |
| Adjustment | IN/OUT | Stock corrections |

---

## Common Tasks

### Find Material Stock
1. Go to **Warehouse** → **Stock Overview**
2. Use search bar
3. Or filter by warehouse dropdown

### Check Dispatch History
1. Go to **Dispatch Orders**
2. Filter by status: **Delivered**
3. Search by dispatch number or branch

### Verify GRN Receipt
1. Go to **Goods Received**
2. Find the GRN
3. Check status is **Approved**
4. Stock should be updated

---

## Common Issues

**Stock not showing after GRN?**
→ GRN must be Approved first

**Can't dispatch - insufficient stock?**
→ Check stock levels, contact production

**Wrong warehouse selected?**
→ Create stock transfer to correct

---

## Contacts
- Warehouse Manager: _____________
- Production: _____________
- Transport: _____________
