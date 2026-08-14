import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';

// Eager imports for 100% Offline PWA Compatibility (prevents dynamic import fetch errors when offline)
import DashboardPage from './pages/DashboardPage';
import RawMaterialsPage from './pages/RawMaterialsPage';
import GoodsReceivedPage from './pages/GoodsReceivedPage';
import QualityInspectionPage from './pages/QualityInspectionPage';
import FormulationsPage from './pages/FormulationsPage';
import ProductionPlanningPage from './pages/ProductionPlanningPage';
import ProductionOrdersPage from './pages/ProductionOrdersPage';
import WarehousePage from './pages/WarehousePage';
import DispatchPage from './pages/DispatchPage';
import ReconciliationPage from './pages/ReconciliationPage';
import SyncLogPage from './pages/SyncLogPage';
import ProductionReportPage from './pages/ProductionReportPage';
import RawMaterialsReportPage from './pages/RawMaterialsReportPage';
import LabourCostReportPage from './pages/LabourCostReportPage';
import SimpleTestPage from './pages/SimpleTestPage';
import DispatchPlanningPage from './pages/DispatchPlanningPage';
import DailyProductionReportPage from './pages/DailyProductionReportPage';
import MaterialTransferPage from './pages/MaterialTransferPage';
import RMCostRegisterPage from './pages/RMCostRegisterPage';
import MonthlyRMReconciliationPage from './pages/MonthlyRMReconciliationPage';
import GrossMarginReportPage from './pages/GrossMarginReportPage';
import MacropackManufacturingPage from './pages/MacropackManufacturingPage';
import RMStockDashboardPage from './pages/RMStockDashboardPage';
import RMReceiptsMatrixPage from './pages/RMReceiptsMatrixPage';
import RMIssuesMatrixPage from './pages/RMIssuesMatrixPage';
import RMHistoryPage from './pages/RMHistoryPage';
import ShiftReportsPage from './pages/ShiftReportsPage';
import ProductionEfficiencyDashboardPage from './pages/ProductionEfficiencyDashboardPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import WeighBridgePage from './pages/WeighBridgePage';
import FinishedGoodsPage from './pages/FinishedGoodsPage';
import ProductionWarehousePage from './pages/ProductionWarehousePage';
import ProcessLossReportPage from './pages/ProcessLossReportPage';
import ChickDistributionPage from './pages/ChickDistributionPage';
import ChickHubPage from './pages/ChickHubPage';
import ChickPurchaseOrders from './pages/chick/ChickPurchaseOrders';
import ChickNightIntake from './pages/chick/ChickNightIntake';
import ChickDeliveryDeclaration from './pages/chick/ChickDeliveryDeclaration';
import ChickInvoiceCapture from './pages/chick/ChickInvoiceCapture';
import FleetManagementPage from './pages/FleetManagementPage';
import ChickReconciliationPage from './pages/chick/ChickReconciliationPage';
import StockTakePage from './pages/StockTakePage';
import StockTakeDetailPage from './pages/StockTakeDetailPage';
import MaintenanceSparesPage from './pages/maintenance/MaintenanceSparesPage';
import MaintenanceTransactionsPage from './pages/maintenance/MaintenanceTransactionsPage';
import MaintenanceLowStockPage from './pages/maintenance/MaintenanceLowStockPage';
import MaintenanceWorkOrdersPage from './pages/maintenance/MaintenanceWorkOrdersPage';
import MaintenancePMSchedulesPage from './pages/maintenance/MaintenancePMSchedulesPage';
import TempWorkersPage from './pages/payroll/TempWorkersPage';
import WorkerAttendancePage from './pages/payroll/WorkerAttendancePage';
import PayrollProcessingPage from './pages/payroll/PayrollProcessingPage';
import PaymentHistoryPage from './pages/payroll/PaymentHistoryPage';
import SagePostingReviewPage from './pages/SagePostingReviewPage';
import PlantIntegrationHubPage from './pages/PlantIntegrationHubPage';
import ManagementReportingPage from './pages/ManagementReportingPage';
import ProductionControlCentrePage from './pages/ProductionControlCentrePage';

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

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <Toaster position="top-right" />
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
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="sales-orders" element={<Navigate to="/" replace />} />
              <Route path="formulations" element={<FormulationsPage />} />
              <Route path="production-planning" element={<ProductionPlanningPage />} />
              <Route path="raw-materials" element={<RawMaterialsPage />} />
              <Route path="goods-received" element={<GoodsReceivedPage />} />
              <Route path="quality-inspection" element={<QualityInspectionPage />} />
              <Route path="material-transfer" element={<MaterialTransferPage />} />
              <Route path="rm-prices" element={<RMCostRegisterPage />} />
              <Route path="production-orders" element={<ProductionOrdersPage />} />
              <Route path="production-control" element={<ProductionControlCentrePage />} />
              <Route path="production-efficiency" element={<ProductionEfficiencyDashboardPage />} />
              <Route path="daily-production-report" element={<DailyProductionReportPage />} />
              <Route path="macropack" element={<MacropackManufacturingPage />} />
              <Route path="warehouse" element={<WarehousePage />} />
              <Route path="dispatch" element={<DispatchPage />} />
              <Route path="fleet" element={<FleetManagementPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="sync-log" element={<SyncLogPage />} />
              <Route path="production-report" element={<ProductionReportPage />} />
              <Route path="rm-report" element={<RawMaterialsReportPage />} />
              <Route path="labour-cost" element={<LabourCostReportPage />} />
              <Route path="dispatch-planning" element={<DispatchPlanningPage />} />
              <Route path="reports/rm-reconciliation" element={<MonthlyRMReconciliationPage />} />
              <Route path="reports/gross-margin" element={<GrossMarginReportPage />} />
              <Route path="reports/process-loss" element={<ProcessLossReportPage />} />
              <Route path="rm-stock-dashboard" element={<RMStockDashboardPage />} />
              <Route path="rm-receipts-matrix" element={<RMReceiptsMatrixPage />} />
              <Route path="rm-issues-matrix" element={<RMIssuesMatrixPage />} />
              <Route path="rm-history" element={<RMHistoryPage />} />
              <Route path="shift-reports" element={<ShiftReportsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="weigh-bridge" element={<WeighBridgePage />} />
              <Route path="finished-goods" element={<FinishedGoodsPage />} />
              <Route path="production-warehouse" element={<ProductionWarehousePage />} />
              <Route path="chick" element={<ChickHubPage />} />
              <Route path="chick-bookings" element={<ChickPurchaseOrders />} />
              <Route path="chick-distribution" element={<ChickDistributionPage />} />
              <Route path="chick/night-intake" element={<ChickNightIntake />} />
              <Route path="chick/delivery-declaration" element={<ChickDeliveryDeclaration />} />
              <Route path="chick/invoice-capture" element={<ChickInvoiceCapture />} />
              <Route path="chick/reconciliation" element={<ChickReconciliationPage />} />
              <Route path="stock-take" element={<StockTakePage />} />
              <Route path="stock-take/:id" element={<StockTakeDetailPage />} />
              <Route path="spare-parts" element={<MaintenanceSparesPage />} />
              <Route path="maintenance-transactions" element={<MaintenanceTransactionsPage />} />
              <Route path="maintenance-low-stock" element={<MaintenanceLowStockPage />} />
              <Route path="maintenance-work-orders" element={<MaintenanceWorkOrdersPage />} />
              <Route path="maintenance-schedules" element={<MaintenancePMSchedulesPage />} />
              <Route path="payroll/temp-workers" element={<TempWorkersPage />} />
              <Route path="payroll/attendance" element={<WorkerAttendancePage />} />
              <Route path="payroll/processing" element={<PayrollProcessingPage />} />
              <Route path="payroll/history" element={<PaymentHistoryPage />} />
              <Route path="sage-posting-review" element={<SagePostingReviewPage />} />
              <Route path="plant-integrations" element={<PlantIntegrationHubPage />} />
              <Route path="management-reporting" element={<ManagementReportingPage />} />
              <Route path="test" element={<SimpleTestPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
