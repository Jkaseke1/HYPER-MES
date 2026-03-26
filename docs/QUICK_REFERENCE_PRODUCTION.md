# 🏭 Production Team - Quick Reference

## Daily Tasks

### Check Production Orders
1. Go to **Production Orders** page
2. Review KPI cards:
   - **Pending** - Orders waiting to start
   - **In Progress** - Currently running
3. Filter by status tab as needed

### Start a Production Order
1. Find order in **Pending** or **Materials Issued** status
2. Click to open details
3. **Issue Materials** (if pending)
4. Click **Start Production**
5. Monitor progress

### Complete Production
1. Open the **In Progress** order
2. Go to **Output** tab
3. Enter:
   - **Actual Qty** produced
   - **Rejected Qty** (if any)
   - **Wastage Qty** (if any)
4. Go to **Costing** tab, verify costs
5. Click **Complete Production**

---

## Production Workflow

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌───────────┐
│ Pending │ → │ Materials    │ → │ In Progress │ → │ Completed │
│         │    │ Issued       │    │             │    │           │
└─────────┘    └──────────────┘    └─────────────┘    └───────────┘
     ↓              ↓                    ↓                 ↓
  Waiting      Raw materials        Production         Done!
  for start    released            running
```

---

## Milestone Timeline
The order detail shows visual progress:
- ✅ Green checkmark = Step complete
- ⚪ Gray circle = Step pending

**Yield Rate Bar**:
- 🟢 Green (95%+) = Excellent
- 🟡 Amber (80-94%) = Acceptable
- 🔴 Red (<80%) = Review needed

---

## Create New Order
1. **+ New Order**
2. Select **Formulation** (auto-loads BOM)
3. Select **Machine**
4. Enter **Planned Qty**
5. Set **Priority** and **Dates**
6. Assign **Operator**
7. Click **Create Order**

---

## Status Guide

| Status | Meaning | Next Action |
|--------|---------|-------------|
| Pending | Created, waiting | Issue Materials |
| Materials Issued | Raw materials released | Start Production |
| In Progress | Currently producing | Record output, Complete |
| Completed | Finished | None |
| Cancelled | Stopped | Review reason |

---

## Priority Levels

| Priority | Color | Meaning |
|----------|-------|---------|
| Low | Gray | Can wait |
| Normal | Blue | Standard |
| High | Orange | Prioritize |
| Urgent | Red | Do immediately |

---

## Daily Report
1. Go to **Daily Reports**
2. Click **+ New Report**
3. Enter shift data:
   - Shift (Day/Night)
   - Plant & Product
   - Target vs Actual
   - Downtime (if any)
4. Submit

---

## Common Issues

**Can't start production?**
→ Materials must be issued first

**Materials not available?**
→ Check with Raw Materials team

**Wrong formulation selected?**
→ Cancel order, create new one

---

## Contacts
- Production Manager: _____________
- Maintenance: _____________
- Raw Materials: _____________
