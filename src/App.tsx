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
const ShiftReportsPage = lazy(() => import('./pages/ShiftReportsPage'));
const MaintenanceWorkOrdersPage = lazy(() => import('./pages/MaintenanceWorkOrdersPage'));
const MaintenanceSchedulePage = lazy(() => import('./pages/MaintenanceSchedulePage'));
const SparePartsPage = lazy(() => import('./pages/SparePartsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const WeighBridgePage = lazy(() => import('./pages/WeighBridgePage'));
const ProductionWarehousePage = lazy(() => import('./pages/ProductionWarehousePage'));
const StockTakePage = lazy(() => import('./pages/StockTakePage'));
const StockTakeDetailPage = lazy(() => import('./pages/StockTakeDetailPage'));

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
          <Route path="/simple-test" element={<SimpleTestPage />} />
          <Route path="/maintenance-work-orders" element={<MaintenanceWorkOrdersPage />} />
          <Route path="/maintenance-schedules" element={<MaintenanceSchedulePage />} />
          <Route path="/spare-parts" element={<SparePartsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/weigh-bridge" element={<WeighBridgePage />} />
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
