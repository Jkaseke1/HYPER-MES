import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/sales-orders': 'Sales Orders',
  '/formulations': 'Formulations & BOM',
  '/production-planning': 'Production Planning',
  '/raw-materials': 'Raw Materials',
  '/goods-received': 'Goods Received',
  '/quality-inspection': 'Quality Inspection',
  '/material-transfer': 'Material Transfer',
  '/rm-prices': 'Raw Material Prices',
  '/production-orders': 'Production Orders',
  '/daily-production-report': 'Daily Production Reports',
  '/macropack': 'Macropack Manufacturing',
  '/warehouse': 'Warehouse Management',
  '/dispatch': 'Dispatch Management',
  '/reconciliation': 'Material Reconciliation',
  '/reports/rm-reconciliation': 'Monthly RM Reconciliation',
  '/reports/gross-margin': 'Gross Margin Report',
  '/reports/process-loss': 'Process Loss & Yield Report',
  '/chick': 'Chick Management',
  '/chick-bookings': 'Chick Bookings',
  '/chick-distribution': 'Chick Distribution',
  '/reports': 'Reports & Analytics',
  '/maintenance-work-orders': 'Maintenance Work Orders',
  '/maintenance-schedules': 'PM Schedules',
  '/spare-parts': 'Spare Parts',
  '/settings': 'Settings',
  '/admin/users': 'User Management',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] || 'Hyperfeeds MES';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, slide in when menu open */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div
        className={`transition-all duration-300 lg:ml-[240px] ${
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        }`}
      >
        <Header
          title={title}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
