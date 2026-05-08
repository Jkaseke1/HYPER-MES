import { NavLink, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Package as PackageIcon,
  PackageCheck,
  ClipboardCheck,
  Beaker,
  ClipboardList,
  Factory,
  Warehouse as WarehouseIcon,
  Truck,
  FileCheck,
  BarChart3 as BarChart3Icon,
  Settings,
  LogOut,
  Wheat,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wrench,
  AlertTriangle,
  PackagePlus,
  ClipboardType,
  ArrowRightLeft,
  Shield,
  Users,
  Activity,
  FileText,
  Package as PackageIcon2,
  DollarSign,
  BarChart3 as BarChart3Icon2,
  TrendingUp,
  Scale,
  Boxes,
  Clock,
  History,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: any;
  label: string;
}

interface NavGroup {
  label: string;
  icon: any;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Planning & Setup',
    icon: ClipboardList,
    items: [
      { to: '/formulations', icon: Beaker, label: 'Formulations (BOM)' },
      { to: '/production-planning', icon: ClipboardList, label: 'Production Planning' },
    ],
  },
  {
    label: 'Raw Materials',
    icon: PackageIcon,
    items: [
      { to: '/weigh-bridge', icon: Scale, label: 'Weigh Bridge' },
      { to: '/goods-received', icon: PackageCheck, label: 'Goods Received (GRN)' },
      { to: '/raw-materials', icon: PackageIcon2, label: 'RM Warehouse / Inventory' },
      { to: '/stock-take', icon: ClipboardList, label: 'Stock Take' },
      { to: '/material-transfer', icon: ArrowRightLeft, label: 'Material Transfer' },
      { to: '/quality-inspection', icon: ClipboardCheck, label: 'Quality Inspection' },
      { to: '/rm-prices', icon: DollarSign, label: 'RM Prices' },
    ],
  },
  {
    label: 'Production',
    icon: Factory,
    items: [
      { to: '/production-orders', icon: Factory, label: 'Production Orders' },
      { to: '/macropack', icon: Beaker, label: 'Macropack Manufacturing' },
      { to: '/production-warehouse', icon: Boxes, label: 'Production Warehouse' },
      { to: '/daily-production-report', icon: ClipboardType, label: 'Daily Reports' },
      { to: '/shift-reports', icon: ClipboardType, label: 'Shift Reports' },
    ],
  },
  {
    label: 'Warehouse & Dispatch',
    icon: WarehouseIcon,
    items: [
      { to: '/warehouse', icon: WarehouseIcon, label: 'Warehouse' },
      { to: '/dispatch', icon: Truck, label: 'Dispatch Orders' },
    ],
  },
  {
    label: 'Reconciliation & Reporting',
    icon: BarChart3Icon,
    items: [
      { to: '/reconciliation', icon: FileCheck, label: 'Reconciliation' },
      { to: '/reports/rm-reconciliation', icon: PackageIcon2, label: 'RM Reconciliation' },
      { to: '/admin/sync-log', icon: Activity, label: 'Sync Log' },
      { to: '/reports/production', icon: BarChart3Icon2, label: 'Production Report' },
      { to: '/reports/raw-materials', icon: PackageIcon2, label: 'Raw Materials Report' },
      { to: '/reports/labour', icon: DollarSign, label: 'Labour Cost Report' },
      { to: '/reports/gross-margin', icon: TrendingUp, label: 'Gross Margin' },
      { to: '/reports', icon: FileText, label: 'Reports' },
    ],
  },
  {
    label: 'Payroll',
    icon: DollarSign,
    items: [
      { to: '/payroll/workers', icon: Users, label: 'Temporary Workers' },
      { to: '/payroll/attendance', icon: Clock, label: 'Attendance' },
      { to: '/payroll/processing', icon: DollarSign, label: 'Payroll Processing' },
      { to: '/payroll/history', icon: History, label: 'Payment History' },
    ],
  },
  {
    label: 'Plant Maintenance',
    icon: Wrench,
    items: [
      { to: '/maintenance/spares', icon: PackagePlus, label: 'Spares Inventory' },
      { to: '/maintenance/transactions', icon: ArrowRightLeft, label: 'Issue/Receive Stock' },
      { to: '/maintenance/low-stock', icon: AlertTriangle, label: 'Low Stock Report' },
      { to: '/maintenance/work-orders', icon: Wrench, label: 'Work Orders' },
    ],
  },
  {
    label: 'System Administration',
    icon: Shield,
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/admin/users', icon: Users, label: 'User Management' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    navGroups.map((g) => g.label)
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const quickAccess = [
    { to: '/production-orders', icon: Factory, label: 'Production Orders' },
    { to: '/raw-materials', icon: PackageIcon2, label: 'RM Inventory' },
    { to: '/dispatch', icon: Truck, label: 'Dispatch Orders' },
    { to: '/reports', icon: FileText, label: 'Reports' },
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return navGroups;
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-slate-950 text-white z-40 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800">
        <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Wheat className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-[11px] font-bold tracking-wide text-white leading-tight uppercase">HYPERFEEDS MANUFACTURING SYSTEM</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">MES</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find module..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/40"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        <div className="px-2 space-y-1.5">
          {/* Dashboard - Always visible */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                isActive
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/80'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          {!collapsed && (
            <div className="mt-3 mb-1">
              <p className="px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Quick Access</p>
              <ul className="mt-1 space-y-0.5">
                {quickAccess.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                          isActive
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grouped Navigation */}
          {visibleGroups.map((group) => {
            const containsActive = group.items.some((item) => item.to === location.pathname);
            const isExpanded = normalizedQuery ? true : expandedGroups.includes(group.label) || containsActive;
            return (
              <div key={group.label} className="mt-4">
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-md ${
                      containsActive ? 'text-slate-200 bg-slate-900/80' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <group.icon className={`w-4 h-4 ${containsActive ? 'text-teal-400' : ''}`} />
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
                {collapsed && (
                  <div className="h-px bg-slate-700/50 my-2" />
                )}
                {(isExpanded || collapsed) && (
                  <ul className="space-y-0.5 mt-1">
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                              isActive
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/35'
                                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/80'
                            } ${!collapsed ? 'ml-2' : ''}`
                          }
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="p-2 border-t border-slate-800 bg-slate-950">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-all duration-150 w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full mt-1 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
