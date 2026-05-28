import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RawMaterialsPage = lazy(() => import('./pages/RawMaterialsPage'));
const GoodsReceivedPage = lazy(() => import('./pages/GoodsReceivedPage'));
const QualityInspectionPage = lazy(() => import('./pages/QualityInspectionPage'));
const FormulationsPage = lazy(() => import('./pages/FormulationsPage'));
const ProductionPlanningPage = lazy(() => import('./pages/ProductionPlanningPage'));
const ProductionOrdersPage = lazy(() => import('./pages/ProductionOrdersPage'));
const WarehousePage = lazy(() => import('./pages/WarehousePage'));
const DispatchPage = lazy(() => import('./pages/DispatchPage'));
const ReconciliationPage = lazy(() => import('./pages/ReconciliationPage'));
const SyncLogPage = lazy(() => import('./pages/SyncLogPage'));
const ProductionReportPage = lazy(() => import('./pages/ProductionReportPage'));
const RawMaterialsReportPage = lazy(() => import('./pages/RawMaterialsReportPage'));
const LabourCostReportPage = lazy(() => import('./pages/LabourCostReportPage'));
const SimpleTestPage = lazy(() => import('./pages/SimpleTestPage'));
const DispatchPlanningPage = lazy(() => import('./pages/DispatchPlanningPage'));
const DailyProductionReportPage = lazy(() => import('./pages/DailyProductionReportPage'));
const MaterialTransferPage = lazy(() => import('./pages/MaterialTransferPage'));
const RMCostRegisterPage = lazy(() => import('./pages/RMCostRegisterPage'));
const MonthlyRMReconciliationPage = lazy(() => import('./pages/MonthlyRMReconciliationPage'));
const GrossMarginReportPage = lazy(() => import('./pages/GrossMarginReportPage'));
const MacropackManufacturingPage = lazy(() => import('./pages/MacropackManufacturingPage'));
const RMStockDashboardPage = lazy(() => import('./pages/RMStockDashboardPage'));
const RMReceiptsMatrixPage = lazy(() => import('./pages/RMReceiptsMatrixPage'));
const RMIssuesMatrixPage = lazy(() => import('./pages/RMIssuesMatrixPage'));
const RMHistoryPage = lazy(() => import('./pages/RMHistoryPage'));
const ShiftReportsPage = lazy(() => import('./pages/ShiftReportsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const WeighBridgePage = lazy(() => import('./pages/WeighBridgePage'));
const ProductionWarehousePage = lazy(() => import('./pages/ProductionWarehousePage'));
const ProcessLossReportPage = lazy(() => import('./pages/ProcessLossReportPage'));
const ChickDistributionPage = lazy(() => import('./pages/ChickDistributionPage'));
const ChickHubPage = lazy(() => import('./pages/ChickHubPage'));
const ChickPurchaseOrders = lazy(() => import('./pages/chick/ChickPurchaseOrders'));
const ChickNightIntake = lazy(() => import('./pages/chick/ChickNightIntake'));
const ChickDeliveryDeclaration = lazy(() => import('./pages/chick/ChickDeliveryDeclaration'));
const ChickInvoiceCapture = lazy(() => import('./pages/chick/ChickInvoiceCapture'));
const StockTakePage = lazy(() => import('./pages/StockTakePage'));
const StockTakeDetailPage = lazy(() => import('./pages/StockTakeDetailPage'));
const MaintenanceSparesPage = lazy(() => import('./pages/maintenance/MaintenanceSparesPage'));
const MaintenanceTransactionsPage = lazy(() => import('./pages/maintenance/MaintenanceTransactionsPage'));
const MaintenanceLowStockPage = lazy(() => import('./pages/maintenance/MaintenanceLowStockPage'));
const MaintenanceWorkOrdersPage = lazy(() => import('./pages/maintenance/MaintenanceWorkOrdersPage'));
const MaintenancePMSchedulesPage = lazy(() => import('./pages/maintenance/MaintenancePMSchedulesPage'));
const TempWorkersPage = lazy(() => import('./pages/payroll/TempWorkersPage'));
const WorkerAttendancePage = lazy(() => import('./pages/payroll/WorkerAttendancePage'));
const PayrollProcessingPage = lazy(() => import('./pages/payroll/PayrollProcessingPage'));
const PaymentHistoryPage = lazy(() => import('./pages/payroll/PaymentHistoryPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/raw-materials" element={<RawMaterialsPage />} />
          <Route path="/raw-materials/dashboard" element={<RMStockDashboardPage />} />
          <Route path="/raw-materials/receipts" element={<RMReceiptsMatrixPage />} />
          <Route path="/raw-materials/issues" element={<RMIssuesMatrixPage />} />
          <Route path="/raw-materials/history" element={<RMHistoryPage />} />
          <Route path="/stock-take" element={<StockTakePage />} />
          <Route path="/stock-take/:id" element={<ErrorBoundary><StockTakeDetailPage /></ErrorBoundary>} />
          <Route path="/goods-received" element={<GoodsReceivedPage />} />
          <Route path="/quality-inspection" element={<QualityInspectionPage />} />
          <Route path="/formulations" element={<FormulationsPage />} />
          <Route path="/sales-orders" element={<DispatchPlanningPage />} />
          <Route path="/production-planning" element={<ProductionPlanningPage />} />
          <Route path="/production-orders" element={<ProductionOrdersPage />} />
          <Route path="/daily-production-report" element={<DailyProductionReportPage />} />
          <Route path="/shift-reports" element={<ShiftReportsPage />} />
          <Route path="/material-transfer" element={<MaterialTransferPage />} />
          <Route path="/rm-prices" element={<RMCostRegisterPage />} />
          <Route path="/macropack" element={<MacropackManufacturingPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="/reports/rm-reconciliation" element={<MonthlyRMReconciliationPage />} />
          <Route path="/admin/sync-log" element={<SyncLogPage />} />
          <Route path="/reports/production" element={<ProductionReportPage />} />
          <Route path="/reports/raw-materials" element={<RawMaterialsReportPage />} />
          <Route path="/reports/labour" element={<LabourCostReportPage />} />
          <Route path="/reports/gross-margin" element={<GrossMarginReportPage />} />
          <Route path="/reports/process-loss" element={<ProcessLossReportPage />} />
          <Route path="/chick-distribution" element={<ChickDistributionPage />} />
          <Route path="/chick" element={<ChickHubPage />} />
          <Route path="/chick/purchase-orders" element={<ChickPurchaseOrders />} />
          <Route path="/chick/night-intake" element={<ChickNightIntake />} />
          <Route path="/chick/delivery-declaration" element={<ChickDeliveryDeclaration />} />
          <Route path="/chick/invoice-capture" element={<ChickInvoiceCapture />} />
          <Route path="/simple-test" element={<SimpleTestPage />} />
          <Route path="/payroll/workers" element={<TempWorkersPage />} />
          <Route path="/payroll/attendance" element={<WorkerAttendancePage />} />
          <Route path="/payroll/processing" element={<PayrollProcessingPage />} />
          <Route path="/payroll/history" element={<PaymentHistoryPage />} />
          <Route path="/maintenance/spares" element={<MaintenanceSparesPage />} />
          <Route path="/maintenance/transactions" element={<MaintenanceTransactionsPage />} />
          <Route path="/maintenance/low-stock" element={<MaintenanceLowStockPage />} />
          <Route path="/maintenance/work-orders" element={<MaintenanceWorkOrdersPage />} />
          <Route path="/maintenance/pm-schedules" element={<MaintenancePMSchedulesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/weigh-bridge" element={<WeighBridgePage />} />
          <Route path="/chick-bookings" element={<Navigate to="/chick/purchase-orders" replace />} />
          <Route path="/production-warehouse" element={<ProductionWarehousePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </HashRouter>
  );
}
