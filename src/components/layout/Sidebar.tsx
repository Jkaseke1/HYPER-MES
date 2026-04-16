import { NavLink } from 'react-router-dom';
import { useState } from 'react';
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
  Calendar,
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
      { to: '/raw-materials', icon: PackageIcon2, label: 'Raw Materials' },
      { to: '/goods-received', icon: PackageCheck, label: 'Goods Received' },
      { to: '/quality-inspection', icon: ClipboardCheck, label: 'Quality Inspection' },
      { to: '/material-transfer', icon: ArrowRightLeft, label: 'Material Transfer' },
      { to: '/rm-prices', icon: DollarSign, label: 'RM Prices' },
    ],
  },
  {
    label: 'Production',
    icon: Factory,
    items: [
      { to: '/production-orders', icon: Factory, label: 'Production Orders' },
      { to: '/daily-production-report', icon: ClipboardType, label: 'Daily Reports' },
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
    label: 'Plant Maintenance',
    icon: Wrench,
    items: [
      { to: '/maintenance-work-orders', icon: Wrench, label: 'Work Orders' },
      { to: '/maintenance-schedules', icon: Calendar, label: 'PM Schedules' },
      { to: '/spare-parts', icon: PackagePlus, label: 'Spare Parts' },
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

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-slate-900 text-white z-40 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50">
        <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Wheat className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Hyperfeeds<br/>Nutrition</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">MES</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-2 space-y-1">
          {/* Dashboard - Always visible */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-teal-500/15 text-teal-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Grouped Navigation */}
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.label);
            return (
              <div key={group.label} className="mt-4">
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <group.icon className="w-4 h-4" />
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
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                              isActive
                                ? 'bg-teal-500/15 text-teal-400'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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

      <div className="p-2 border-t border-slate-700/50">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all duration-150 w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full mt-1 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
