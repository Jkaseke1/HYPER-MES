import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/raw-materials': 'Raw Materials',
  '/formulations': 'Formulations & BOM',
  '/production-planning': 'Production Planning',
  '/production-orders': 'Production Orders',
  '/warehouse': 'Warehouse Management',
  '/dispatch': 'Dispatch Management',
  '/reconciliation': 'Material Reconciliation',
  '/reports': 'Reports & Analytics',
  '/settings': 'Settings',
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
