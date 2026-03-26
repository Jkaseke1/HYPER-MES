# HYPER MES User Guide

## Overview
HYPER MES is a Manufacturing Execution System for feed manufacturing operations. This guide covers the main modules for each team.

---

## 🔐 Getting Started

1. **Access the System**: Open the application URL in your browser
2. **Login**: Enter your email and password
3. **Navigation**: Use the left sidebar to access different modules

---

## 📦 Raw Materials Team Guide

### Raw Materials Module
**Location**: Sidebar → Raw Materials → Raw Materials

#### View Materials
- See all raw materials with stock levels, costs, and status
- **KPI Cards** at top show: Total Materials, Low Stock, Out of Stock, Total Value
- Use category tabs (Grain, Protein, Mineral, etc.) to filter
- Search by name or code

#### Add New Material
1. Click **+ Add Material** button
2. Fill in required fields:
   - **Name**: e.g., "Yellow Maize"
   - **Code**: e.g., "RM-001"
   - **Category**: Select from dropdown
   - **Unit**: kg, ton, litre, bag
   - **Cost per Unit**: Enter price
   - **Reorder Level**: Minimum stock threshold
3. Click **Add Material**

#### Stock Status Indicators
| Status | Meaning |
|--------|---------|
| 🟢 In Stock | Stock above reorder level |
| 🟡 Low Stock | Stock at or below reorder level |
| 🔴 Out of Stock | Zero stock |

---

### Goods Received Notes (GRN)
**Location**: Sidebar → Raw Materials → Goods Received

#### Create a GRN
1. Click **+ Create GRN**
2. Enter GRN details:
   - **GRN Number**: Auto-generated or custom
   - **Supplier**: Select from list
   - **Warehouse**: Destination warehouse
   - **Received Date**: Date of receipt
3. Add line items:
   - Select **Material**
   - Enter **Ordered Qty** and **Received Qty**
   - Enter **Unit Cost** and **Batch Number**
4. Click **Create GRN**

#### GRN Approval
- New GRNs have **Pending** status
- Authorized users can **Approve** or **Reject**
- Approved GRNs update stock automatically

---

### Quality Inspection
**Location**: Sidebar → Raw Materials → Quality Inspection

#### Create Inspection
1. Click **+ Create Inspection**
2. Select **GRN** and **Material**
3. Enter test results:
   - Moisture Content (%)
   - Protein Content (%)
   - Fat Content (%)
   - Fiber Content (%)
4. Set **Result**: Passed, Failed, or Pending
5. Add remarks if needed

---

## 🏭 Production Team Guide

### Production Orders
**Location**: Sidebar → Production → Production Orders

#### View Orders
- **KPI Cards**: Total Orders, Pending, In Progress, Completed
- Filter by status tabs: All, Pending, Materials Issued, In Progress, Completed
- Search by batch number

#### Create Production Order
1. Click **+ New Order**
2. Fill in details:
   - **Batch Number**: Auto-generated
   - **Formulation**: Select product formula
   - **Machine**: Select production line
   - **Planned Qty**: Target quantity
   - **Priority**: Low, Normal, High, Urgent
   - **Operator**: Assign operator
   - **Planned Start/End**: Schedule dates
3. Review **Bill of Materials** (auto-calculated)
4. Click **Create Order**

#### Production Workflow
```
Pending → Materials Issued → In Progress → Completed
```

1. **Issue Materials**: Click "Issue Materials" to release raw materials
2. **Start Production**: Click "Start Production" when ready
3. **Record Output**: Enter actual quantities produced
4. **Complete**: Click "Complete Production" when done

#### Milestone Timeline
- Visual progress tracker shows current stage
- **Yield Rate** bar shows actual vs planned percentage

---

### Formulations (BOM)
**Location**: Sidebar → Production → Formulations (BOM)

#### View Formulations
- **KPI Cards**: Total Formulas, Active, Draft, Archived
- Filter by category: Broiler, Layer, Dairy, Pig, etc.
- Each card shows: Version, Batch Size, Cost/Unit

#### Create Formula
1. Click **+ New Formula**
2. Enter header info:
   - Name, Code, Category
   - Batch Size and Unit
   - Target nutritional values
3. Add ingredients:
   - Select raw material
   - Enter quantity and percentage
   - Mark critical ingredients
4. **Percentages must total 100%**
5. Click **Save**

#### Compare Formulas
1. Click **Compare** button
2. Select 2 formulas to compare
3. Click **View Comparison** to see side-by-side

---

### Production Planning
**Location**: Sidebar → Production → Production Planning

#### Create Plan
1. Click **+ New Plan**
2. Set plan dates (start/end)
3. Add items:
   - Select formulation
   - Enter planned quantity
   - Set priority
4. Click **Save**

#### Plan Status Flow
```
Draft → Confirmed → In Progress → Completed
```

---

## 📊 Daily Reports
**Location**: Sidebar → Production → Daily Reports

#### Submit Daily Report
1. Click **+ New Report**
2. Enter:
   - Date and Shift (Day/Night)
   - Plant Name
   - Product Name
   - Daily Target and Actual Production
   - Quantity Sold
   - Labour Force count
   - Downtime (if any)
3. Submit report

---

## 🚚 Warehouse & Dispatch Team Guide

### Warehouse Management
**Location**: Sidebar → Warehouse & Dispatch → Warehouse

#### Stock Overview Tab
- View all materials across warehouses
- Filter by warehouse
- Sort by any column
- Stock level indicators show health

#### Stock Movements Tab
- Track all stock in/out movements
- Filter by date range and movement type
- View movement history

---

### Dispatch Orders
**Location**: Sidebar → Warehouse & Dispatch → Dispatch Orders

#### Create Dispatch
1. Click **+ New Dispatch**
2. Select branch destination
3. Add products and quantities
4. Assign vehicle and driver
5. Submit dispatch

#### Dispatch Status
| Status | Meaning |
|--------|---------|
| Pending | Awaiting loading |
| Loading | Being loaded |
| Dispatched | Left warehouse |
| In Transit | On the way |
| Delivered | Completed |

---

## 🔧 Maintenance Team Guide

### Work Orders
**Location**: Sidebar → Plant Maintenance → Work Orders

#### KPI Cards
- Total Work Orders
- Open / In Progress
- Completed
- Critical Priority

#### Create Work Order
1. Click **+ New Work Order**
2. Enter details:
   - Title and Description
   - Machine and Branch
   - Work Type: Preventive, Corrective, Breakdown
   - Priority: Low, Medium, High, Critical
   - Assign technician
   - Schedule date
3. Submit

---

### PM Schedules
**Location**: Sidebar → Plant Maintenance → PM Schedules

#### Create Schedule
1. Click **+ New Schedule**
2. Set:
   - Machine
   - Maintenance Type
   - Frequency (Daily, Weekly, Monthly, etc.)
   - Next Due Date
   - Assign technician

---

### Spare Parts
**Location**: Sidebar → Plant Maintenance → Spare Parts

- Track spare parts inventory
- **Low Stock Alert** shows parts below reorder level
- Mark critical parts for priority ordering

---

## 📈 Reports & Analytics
**Location**: Sidebar → Reports & Settings → Reports

### Available Reports
- **Production**: Output by formulation
- **Variance**: Planned vs Actual analysis
- **Costing**: Cost breakdown
- **Inventory**: Stock value analysis

---

## ⚙️ Settings
**Location**: Sidebar → Reports & Settings → Settings

Manage:
- Branches
- Warehouses
- Machines
- Suppliers
- User Profile

---

## 💡 Tips

1. **Refresh Data**: If data seems stale, refresh the page
2. **Search**: Most pages have search - use it to find records quickly
3. **Status Badges**: Color-coded for quick identification
4. **KPI Cards**: Always check the top cards for quick overview
5. **Mobile**: The system works on tablets for shop floor use

---

## 🆘 Need Help?

Contact your system administrator for:
- Password resets
- Access permissions
- Technical issues
