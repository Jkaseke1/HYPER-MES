# System-Wide Design Update Plan

## 🎯 Objective
Apply modern shadcn/ui design to **ALL forms and pages** in HYPER-MES

## 📋 Strategy

### Phase 1: Update Shared Components ✅
Update core components used across the system. This will automatically modernize all pages.

#### Components to Update:
1. ✅ **Modal** → Use shadcn Dialog
2. ⏳ **StatusBadge** → Use shadcn Badge  
3. ⏳ **StatCard** → Enhanced with shadcn Card
4. ⏳ **Form Inputs** → Create wrapper components

### Phase 2: Page-by-Page Updates
Systematically update each major page to use new components.

## 📊 Pages Inventory

### ✅ Completed
- [x] **GoodsReceivedPage** - Fully modernized with shadcn/ui

### 🔄 In Progress
- [ ] **ProductionOrdersPage** - Large, complex page
- [ ] **RawMaterialsPage** - Inventory management
- [ ] **FormulationsPage** - Recipe management

### ⏳ Pending - High Priority
- [ ] **DispatchPage** - Order fulfillment
- [ ] **WarehousePage** - Stock management
- [ ] **QualityInspectionPage** - QC workflows
- [ ] **ProductionPlanningPage** - Planning interface
- [ ] **DashboardPage** - Main dashboard

### ⏳ Pending - Medium Priority
- [ ] **MaterialTransferPage**
- [ ] **DispatchPlanningPage**
- [ ] **MacropackManufacturingPage**
- [ ] **WeighBridgePage**
- [ ] **StockTakePage**
- [ ] **StockTakeDetailPage**

### ⏳ Pending - Reports
- [ ] **ProductionReportPage**
- [ ] **RawMaterialsReportPage**
- [ ] **LabourCostReportPage**
- [ ] **GrossMarginReportPage**
- [ ] **DailyProductionReportPage**
- [ ] **MonthlyRMReconciliationPage**
- [ ] **RMCostRegisterPage**

### ⏳ Pending - Maintenance Module
- [ ] **MaintenanceSparesPage** - Already updated
- [ ] **MaintenanceWorkOrdersPage** - Already updated
- [ ] **MaintenancePMSchedulesPage** - Already updated
- [ ] **MaintenanceTransactionsPage**
- [ ] **MaintenanceLowStockPage**

### ⏳ Pending - Payroll Module
- [ ] **TempWorkersPage**
- [ ] **WorkerAttendancePage**
- [ ] **PayrollProcessingPage**
- [ ] **PaymentHistoryPage**

### ⏳ Pending - Admin
- [ ] **SettingsPage**
- [ ] **AdminUsersPage**
- [ ] **SyncLogPage**

## 🔧 Component Update Checklist

For each page, update:
- [ ] Replace `<Modal>` with `<Dialog>`
- [ ] Replace custom buttons with `<Button>`
- [ ] Replace `<StatusBadge>` with `<Badge>`
- [ ] Replace custom inputs with `<Input>`, `<Select>`, `<Textarea>`
- [ ] Replace custom tables with `<Table>`
- [ ] Replace custom cards with `<Card>`
- [ ] Update form layouts to use shadcn patterns
- [ ] Ensure proper spacing and typography
- [ ] Test functionality

## 📦 New Component Wrappers

Create these wrapper components for easy migration:

### 1. FormInput.tsx
```tsx
import { Input } from './ui/input';
import { Label } from './ui/label';

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}

export function FormInput({ label, value, onChange, type = 'text', required, placeholder }: FormInputProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
```

### 2. FormSelect.tsx
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export function FormSelect({ label, value, onChange, options, required, placeholder }: FormSelectProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

## 🎨 Design Tokens

### Colors
- **Primary**: Teal (600)
- **Success**: Emerald (600)
- **Warning**: Amber (600)
- **Error**: Red (600)
- **Info**: Blue (600)

### Typography
- **Headings**: font-bold, tracking-tight
- **Body**: text-sm to text-base
- **Muted**: text-muted-foreground

### Spacing
- **Cards**: p-6
- **Sections**: space-y-6
- **Form fields**: space-y-4
- **Buttons**: px-4 py-2

## 📈 Progress Tracking

**Total Pages**: ~35
**Completed**: 1 (3%)
**In Progress**: 0
**Remaining**: 34

## ⏱️ Estimated Timeline

- **Phase 1** (Shared Components): 2-3 hours
- **Phase 2** (High Priority Pages): 4-6 hours
- **Phase 3** (Medium Priority Pages): 3-4 hours
- **Phase 4** (Reports & Admin): 2-3 hours
- **Testing & QA**: 2-3 hours

**Total**: 13-19 hours of development

## 🚀 Deployment Strategy

1. Update in batches (5-10 pages at a time)
2. Test each batch thoroughly
3. Deploy incrementally
4. Monitor for issues
5. Rollback capability via git

## 📝 Notes

- Keep backup files (.backup.tsx) for critical pages
- Test with real data before deploying
- Ensure all Supabase queries still work
- Maintain backward compatibility where possible
- Document any breaking changes

---

**Started**: May 10, 2026
**Status**: Phase 1 - In Progress
**Next**: Update Modal and StatusBadge components
