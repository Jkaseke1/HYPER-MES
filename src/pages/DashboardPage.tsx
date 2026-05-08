import { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Factory, ClipboardList, Truck, TrendingUp, AlertTriangle, Radio, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProductionOrder, RawMaterial, MonthlyTrendRow, InventoryForecastRow } from '../types/database';
import StatusBadge from '../components/ui/StatusBadge';
import PendingApprovalsWidget from '../components/dashboard/PendingApprovalsWidget';

// Compact stat tile for the dashboard — denser than the shared StatCard
function StatTile({ icon: Icon, label, value, subtitle, tone = 'teal' }: {
  icon: LucideIcon; label: string; value: string | number; subtitle?: string;
  tone?: 'teal' | 'amber' | 'blue' | 'emerald' | 'slate';
}) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 px-4 py-3.5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-0.5 leading-tight">{value}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${tones[tone]} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

interface DashboardStats {
  totalProduction: number;
  activeOrders: number;
  rawMaterialCount: number;
  formulationCount: number;
  pendingDispatches: number;
  efficiency: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProduction: 0, activeOrders: 0, rawMaterialCount: 0,
    formulationCount: 0, pendingDispatches: 0, efficiency: 0,
  });
  const [recentOrders, setRecentOrders] = useState<ProductionOrder[]>([]);
  const [lowStockItems, setLowStockItems] = useState<RawMaterial[]>([]);
  const [trends, setTrends] = useState<MonthlyTrendRow[]>([]);
  const [inventoryForecasts, setInventoryForecasts] = useState<InventoryForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveOrders, setLiveOrders] = useState<ProductionOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchLiveOrders = useCallback(async () => {
    const { data } = await supabase
      .from('production_orders')
      .select('*, formulations(name, code)')
      .in('status', ['materials_issued', 'in_progress', 'pending'])
      .order('created_at', { ascending: false })
      .limit(8);
    setLiveOrders((data as ProductionOrder[]) || []);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchLiveOrders();
    const channel = supabase
      .channel('live-production')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders' }, () => {
        fetchLiveOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLiveOrders]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const [ordersRes, materialsRes, formulationsRes, dispatchRes, recentRes, stockRes, trendRes, forecastRes] =
        await Promise.all([
          supabase.from('production_orders').select('planned_qty, actual_qty, status'),
          supabase.from('raw_materials').select('id', { count: 'exact', head: true }),
          supabase.from('formulations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('dispatch_orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'loading']),
          supabase.from('production_orders').select('*, formulations(name, code)').order('created_at', { ascending: false }).limit(10),
          supabase.from('raw_materials').select('id, name, code, unit, current_stock, reorder_level, alert_threshold_pct, days_of_cover_target').order('name'),
          supabase.from('monthly_operations_trends').select('*'),
          supabase.from('inventory_depletion_forecasts').select('*'),
        ]);

      const orders = ordersRes.data || [];
      const completed = orders.filter((o) => o.status === 'completed');
      const totalProd = completed.reduce((sum, o) => sum + (o.actual_qty || 0), 0);
      const activeCount = orders.filter((o) => ['pending', 'materials_issued', 'in_progress'].includes(o.status)).length;
      const totalPlanned = completed.reduce((sum, o) => sum + (o.planned_qty || 0), 0);
      const efficiency = totalPlanned > 0 ? Math.round((totalProd / totalPlanned) * 100) : 0;

      setStats({
        totalProduction: Math.round(totalProd * 10) / 10,
        activeOrders: activeCount,
        rawMaterialCount: materialsRes.count || 0,
        formulationCount: formulationsRes.count || 0,
        pendingDispatches: dispatchRes.count || 0,
        efficiency,
      });
      setRecentOrders((recentRes.data as ProductionOrder[]) || []);
      
      // Filter low stock items in JavaScript
      const allMaterials = (stockRes.data as RawMaterial[]) || [];
      setLowStockItems(allMaterials);
      setTrends((trendRes.data as MonthlyTrendRow[]) || []);
      setInventoryForecasts((forecastRes.data as InventoryForecastRow[]) || []);
      
      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  const forecastMap = useMemo(() => {
    return inventoryForecasts.reduce<Record<string, InventoryForecastRow>>((acc, row) => {
      acc[row.raw_material_id] = row;
      return acc;
    }, {});
  }, [inventoryForecasts]);

  function getSeverity(item: RawMaterial) {
    const forecast = forecastMap[item.id];
    const thresholdStock = item.reorder_level * (1 + item.alert_threshold_pct);
    const belowLevel = item.current_stock <= thresholdStock;
    const daysToDepletion = forecast?.days_to_depletion;
    const belowDays = typeof daysToDepletion === 'number'
      ? daysToDepletion <= item.days_of_cover_target
      : false;
    if (belowLevel && belowDays) return 'critical';
    if (belowLevel || belowDays) return 'warning';
    return 'healthy';
  }

  const filteredLowStock = lowStockItems
    .map((item) => ({ item, severity: getSeverity(item) }))
    .filter(({ severity }) => severity !== 'healthy');

  const trendChartData = trends.map((row) => ({
    month: format(new Date(row.month), 'MMM yyyy'),
    production: Number(row.production_t || 0),
    consumption: Math.abs(Number(row.consumption_t || 0)),
    dispatch: Number(row.dispatch_t || 0),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time manufacturing overview and critical workflows</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Updated {format(lastUpdated, 'HH:mm:ss')}</span>
          <button
            onClick={fetchLiveOrders}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            title="Refresh live floor"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Hero row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-2xl border border-teal-200/70 bg-gradient-to-br from-white to-teal-50/30 shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <Radio className="w-4 h-4 text-teal-600" />
                <span className="absolute w-2 h-2 bg-teal-500 rounded-full top-0 right-0 animate-ping opacity-75" />
              </div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">Live Production Floor</h2>
              <span className="text-xs text-slate-500 ml-1">Real-time · {liveOrders.length} running</span>
            </div>
            <span className="text-xs text-slate-500">{format(lastUpdated, 'HH:mm:ss')}</span>
          </div>
          {liveOrders.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No active production orders on the floor</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {liveOrders.map(order => {
                const yieldPct = order.planned_qty > 0 ? Math.min(100, Math.round(((order.actual_qty || 0) / order.planned_qty) * 100)) : 0;
                const statusColor = order.status === 'in_progress' ? 'bg-teal-500' : order.status === 'materials_issued' ? 'bg-amber-500' : 'bg-slate-400';
                const statusBg = order.status === 'in_progress' ? 'border-teal-200 bg-teal-50/60' : order.status === 'materials_issued' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white/80';
                const label = order.status === 'in_progress' ? 'Running' : order.status === 'materials_issued' ? 'Issued' : 'Pending';
                return (
                  <div key={order.id} className={`rounded-xl border p-2.5 ${statusBg}`}>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-slate-500 truncate">{order.batch_number}</p>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-tight line-clamp-1">{order.formulations?.name || '—'}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded text-white ${statusColor} shrink-0`}>
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-medium text-slate-700">{(order.actual_qty || 0).toLocaleString()} / {order.planned_qty.toLocaleString()} {order.unit}</span>
                      <span className="font-semibold text-slate-700">{yieldPct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${order.status === 'in_progress' ? 'bg-teal-500' : 'bg-amber-400'}`}
                        style={{ width: `${yieldPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-1">
          <PendingApprovalsWidget limit={5} compact />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Factory} label="Total Production" value={`${stats.totalProduction} t`} subtitle="Completed output" tone="teal" />
        <StatTile icon={ClipboardList} label="Active Orders" value={stats.activeOrders} subtitle="In pipeline" tone="blue" />
        <StatTile icon={Truck} label="Pending Dispatches" value={stats.pendingDispatches} subtitle="Awaiting shipment" tone="amber" />
        <StatTile icon={TrendingUp} label="Efficiency" value={`${stats.efficiency}%`} subtitle="Actual vs planned" tone="teal" />
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">Operations Trends</h2>
            <span className="text-xs text-slate-500">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dispatchGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
              <Area type="monotone" dataKey="production" stroke="#0d9488" strokeWidth={2} fill="url(#prodGradient)" name="Production (t)" />
              <Area type="monotone" dataKey="consumption" stroke="#f97316" strokeWidth={2} fill="url(#consumptionGradient)" name="Consumption (t)" />
              <Area type="monotone" dataKey="dispatch" stroke="#6366f1" strokeWidth={2} fill="url(#dispatchGradient)" name="Dispatch (t)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">Stock Alerts</h2>
            </div>
            <span className="text-xs text-slate-500">{filteredLowStock.length} items</span>
          </div>
          {filteredLowStock.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">All stock levels are healthy</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {filteredLowStock.map(({ item, severity }) => (
                <div key={item.id} className={`flex items-center justify-between px-4 py-2.5 ${severity === 'critical' ? 'bg-red-50/40' : 'bg-amber-50/30'}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{item.code}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-sm font-bold ${severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{item.current_stock.toLocaleString()} {item.unit}</p>
                    <p className="text-[11px] text-slate-400">Min: {item.reorder_level} {item.unit}</p>
                    {typeof forecastMap[item.id]?.days_to_depletion === 'number' && (
                      <p className="text-[11px] text-slate-500">~{Math.round(forecastMap[item.id]!.days_to_depletion!)}d cover</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">Inventory Depletion Forecast</h2>
          <span className="text-xs text-slate-500">Avg daily usage (30d)</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Computed from <span className="font-mono text-slate-500">stock_movements</span> (production_input/issue) over the last 30 days · Days to depletion = current stock ÷ avg daily usage. &ldquo;Stable&rdquo; means no consumption recorded in the window.
        </p>
        {inventoryForecasts.length === 0 ? (
          <p className="text-sm text-slate-400">No usage history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Avg/day</th>
                  <th className="px-3 py-2 text-right">Days to Depletion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryForecasts.slice(0, 8).map((row) => (
                  <tr key={row.raw_material_id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-700">{row.name}</p>
                      <p className="text-xs text-slate-400">{row.code}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.current_stock.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.avg_daily_usage.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      {row.days_to_depletion ? (
                        <span className={`text-sm font-semibold ${row.days_to_depletion <= 5 ? 'text-red-600' : row.days_to_depletion <= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {Math.round(row.days_to_depletion)} days
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Stable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">Recent Production Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-medium">Batch</th>
                <th className="px-5 py-3 text-left font-medium">Product</th>
                <th className="px-5 py-3 text-left font-medium">Planned Qty</th>
                <th className="px-5 py-3 text-left font-medium">Actual Qty</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">No production orders found</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-700">{order.batch_number}</td>
                    <td className="px-5 py-3 text-slate-600">{order.formulations?.name || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{order.planned_qty} {order.unit}</td>
                    <td className="px-5 py-3 text-slate-600">{order.actual_qty} {order.unit}</td>
                    <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-3 text-slate-500">{format(new Date(order.created_at), 'dd MMM yyyy')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
