# 🔧 Maintenance Team - Quick Reference

## Daily Tasks

### Check Work Orders
1. Go to **Work Orders** page
2. Review KPI cards:
   - 🔴 **Critical Priority** - Do first!
   - 🟡 **Open / In Progress** - Active work
3. Filter by status or priority

### Check PM Schedules
1. Go to **PM Schedules** page
2. Review:
   - **Due This Week** - Plan these
   - **Overdue** - Address immediately
3. Overdue items highlighted in red

---

## Work Order Workflow

```
┌──────┐    ┌──────────┐    ┌─────────────┐    ┌───────────┐
│ Open │ → │ Assigned │ → │ In Progress │ → │ Completed │
└──────┘    └──────────┘    └─────────────┘    └───────────┘
```

---

## Create Work Order
1. **+ New Work Order**
2. Fill in:
   - **Title**: Brief description
   - **Machine**: Select equipment
   - **Work Type**: Preventive, Corrective, Breakdown
   - **Priority**: Low, Medium, High, Critical
   - **Assigned To**: Select technician
   - **Scheduled Date**: When to do
3. Add description and notes
4. Submit

---

## Work Order Types

| Type | When to Use |
|------|-------------|
| **Preventive** | Scheduled maintenance |
| **Corrective** | Fix known issue |
| **Breakdown** | Emergency repair |
| **Inspection** | Check/verify condition |

---

## Priority Guide

| Priority | Response Time | Color |
|----------|--------------|-------|
| Critical | Immediate | 🔴 Red |
| High | Same day | 🟠 Orange |
| Medium | Within 3 days | 🟡 Yellow |
| Low | Within week | ⚪ Gray |

---

## PM Schedules

### Create Schedule
1. **PM Schedules** → **+ New Schedule**
2. Set:
   - **Machine**
   - **Maintenance Type**
   - **Frequency**: Daily, Weekly, Monthly, Quarterly, Yearly
   - **Next Due Date**
   - **Assigned To**
3. Save

### Schedule Status
| Status | Meaning |
|--------|---------|
| Active | Running on schedule |
| Due Soon | Coming up this week |
| Overdue | Past due date |
| Inactive | Paused/completed |

---

## Spare Parts

### Check Stock
1. Go to **Spare Parts** page
2. Review:
   - **Low / Out of Stock** count
   - **Critical Parts** count
3. Low stock alert shows parts needing reorder

### Add Spare Part
1. **+ Add Spare Part**
2. Enter:
   - Code, Name, Category
   - Current Stock, Reorder Level
   - Unit Cost
   - Mark as **Critical** if essential
3. Save

---

## Recording Work

### Complete a Work Order
1. Open the work order
2. Update:
   - **Actual Duration**
   - **Downtime Minutes**
   - **Root Cause** (if corrective)
   - **Corrective Action** taken
   - **Labor Cost** and **Parts Cost**
3. Change status to **Completed**
4. Save

---

## Common Issues

**Machine not in list?**
→ Contact admin to add in Settings

**Can't find spare part?**
→ Add new part or check category filter

**PM overdue but done?**
→ Update the schedule, set new due date

---

## Contacts
- Maintenance Manager: _____________
- Production: _____________
- Spare Parts Supplier: _____________
