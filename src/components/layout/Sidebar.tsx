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
  Calendar,
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
      { to: '/maintenance/pm-schedules', icon: Calendar, label: 'PM Schedules' },
      { to: '/maintenance/work-orders', icon: Wrench, label: 'Work Orders' },
      { to: '/maintenance/spares', icon: PackagePlus, label: 'Spares Inventory' },
      { to: '/maintenance/transactions', icon: ArrowRightLeft, label: 'Issue/Receive Stock' },
      { to: '/maintenance/low-stock', icon: AlertTriangle, label: 'Low Stock Report' },
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const toggleGroup = (label: string) => {
    setExpandedGroup((prev) => (prev === label ? null : label));
  };

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

  const { profile, signOut: doSignOut } = useAuth() as any;
  const initials = (profile?.full_name || profile?.email || 'U').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#0c1f2e] text-white z-40 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 flex-shrink-0">
        <div className="w-8 h-8 bg-[#00d4aa] rounded flex items-center justify-center flex-shrink-0">
          <div className="w-4 h-4 border-2 border-white rounded-sm" />
        </div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <h1 className="text-[13px] tracking-wide text-white/90 uppercase">Hyperfeeds</h1>
            <p className="text-[11px] text-white/50 uppercase tracking-wider">Manufacturing System</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find module..."
              className="w-full pl-8 pr-3 py-1.5 rounded border border-white/5 bg-white/5 text-[12px] text-white/80 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/40 focus:border-[#00d4aa]/40"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
        {/* Dashboard - Always visible */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded text-[13px] transition-colors ${
              isActive
                ? 'bg-white/5 text-white/90'
                : 'text-white/50 hover:text-white/70'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? 'bg-[#00d4aa]' : 'bg-transparent'}`} />
              {!collapsed ? (
                <span>Dashboard</span>
              ) : (
                <LayoutDashboard className={`w-4 h-4 ${isActive ? 'text-[#00d4aa]' : ''}`} />
              )}
            </>
          )}
        </NavLink>

        {/* Grouped Navigation */}
        {visibleGroups.map((group) => {
          const containsActive = group.items.some((item) => item.to === location.pathname);
          const isExpanded = normalizedQuery ? true : expandedGroup === group.label || containsActive;
          return (
            <div key={group.label}>
              {!collapsed && (
                <>
                  <div className="my-3 border-t border-white/5" />
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`flex items-center justify-between w-full px-3 mb-2 text-[10px] uppercase tracking-wider transition-colors ${
                      containsActive ? 'text-white/50' : 'text-white/30 hover:text-white/50'
                    }`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </>
              )}
              {collapsed && <div className="h-px bg-white/5 my-2" />}
              {isExpanded && !collapsed && (
                <div>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded text-[13px] transition-colors ${
                          isActive
                            ? 'bg-white/5 text-white/90'
                            : 'text-white/50 hover:text-white/70'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? 'bg-[#00d4aa]' : 'bg-transparent'}`} />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
              {isExpanded && collapsed && (
                <div>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        `flex items-center justify-center px-2 py-2 mb-0.5 rounded transition-colors ${
                          isActive ? 'bg-white/5 text-[#00d4aa]' : 'text-white/50 hover:text-white/70'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User profile + sign out */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 bg-[#00d4aa]/20 rounded-full flex items-center justify-center text-[11px] text-[#00d4aa] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/80 truncate">{profile?.full_name || profile?.email || 'User'}</p>
              <p className="text-[10px] text-white/40 truncate">{profile?.role || 'Operator'}</p>
            </div>
            <button
              onClick={doSignOut || signOut}
              title="Sign out"
              className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 bg-[#00d4aa]/20 rounded-full flex items-center justify-center text-[11px] text-[#00d4aa]">
              {initials}
            </div>
            <button
              onClick={doSignOut || signOut}
              title="Sign out"
              className="text-white/30 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-1.5 mt-1 rounded text-white/30 hover:text-white/70 transition-all"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
