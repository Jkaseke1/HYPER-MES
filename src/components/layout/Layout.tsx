import { useState } from 'react';
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
  '/warehouse': 'Warehouse Management',
  '/dispatch': 'Dispatch Management',
  '/reconciliation': 'Material Reconciliation',
  '/reports/rm-reconciliation': 'Monthly RM Reconciliation',
  '/reports': 'Reports & Analytics',
  '/maintenance-work-orders': 'Maintenance Work Orders',
  '/maintenance-schedules': 'PM Schedules',
  '/spare-parts': 'Spare Parts',
  '/settings': 'Settings',
  '/admin/users': 'User Management',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] || 'Hyperfeeds MES';

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className={`transition-all duration-300 ${
          collapsed ? 'ml-[68px]' : 'ml-[240px]'
        }`}
      >
        <Header title={title} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
