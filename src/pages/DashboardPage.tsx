import { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Circle, Play, Activity, Gauge, Users, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProductionOrder, RawMaterial, MonthlyTrendRow, InventoryForecastRow } from '../types/database';
import StatusBadge from '../components/ui/StatusBadge';
import PendingApprovalsWidget from '../components/dashboard/PendingApprovalsWidget';

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

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Operations Command Center</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[12px]">
              <Circle className="w-2.5 h-2.5 fill-[#00d4aa] text-[#00d4aa]" />
              <span className="text-gray-500">Materials:</span>
              <span className="font-medium text-gray-800">{stats.rawMaterialCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <Circle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />
              <span className="text-gray-500">Active Formulations:</span>
              <span className="font-medium text-gray-800">{stats.formulationCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <Circle className={`w-2.5 h-2.5 ${filteredLowStock.length > 0 ? 'fill-amber-500 text-amber-500' : 'fill-emerald-500 text-emerald-500'}`} />
              <span className="text-gray-500">Alerts:</span>
              <span className={`font-medium ${filteredLowStock.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{filteredLowStock.length}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Updated {format(lastUpdated, 'HH:mm:ss')}</p>
            <p className="text-[12px] text-gray-600">{format(lastUpdated, 'EEEE, MMM d')}</p>
          </div>
          <button
            onClick={fetchLiveOrders}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Refresh live floor"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Live Production Floor - Single Hero Card */}
      {(() => {
        const heroOrder = liveOrders.find(o => o.status === 'in_progress') || liveOrders[0];
        const yieldPct = heroOrder && heroOrder.planned_qty > 0 ? Math.min(100, Math.round(((heroOrder.actual_qty || 0) / heroOrder.planned_qty) * 100)) : 0;
        const runtimeMs = heroOrder?.actual_start ? Date.now() - new Date(heroOrder.actual_start).getTime() : 0;
        const runtimeHrs = Math.floor(runtimeMs / 3600000);
        const runtimeMin = Math.floor((runtimeMs % 3600000) / 60000);
        const runtimeSec = Math.floor((runtimeMs % 60000) / 1000);
        const runtimeStr = heroOrder?.actual_start
          ? `${String(runtimeHrs).padStart(2, '0')}:${String(runtimeMin).padStart(2, '0')}:${String(runtimeSec).padStart(2, '0')}`
          : '--:--:--';
        const throughput = heroOrder && runtimeHrs > 0 ? Math.round((heroOrder.actual_qty || 0) / Math.max(runtimeHrs, 0.5)) : 0;
        const isRunning = heroOrder?.status === 'in_progress';

        return (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h2 className="text-[13px] font-semibold text-gray-900 uppercase tracking-wide">Live Production Floor</h2>
              </div>
              <div className="text-[12px]">
                <span className="text-gray-400">Status: </span>
                <span className={`font-medium ${isRunning ? 'text-[#00d4aa]' : 'text-gray-500'}`}>{isRunning ? 'Running' : heroOrder ? 'Idle' : 'No Orders'}</span>
              </div>
            </div>

            {!heroOrder ? (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-10 text-center border border-gray-100">
                <p className="text-sm text-gray-500">No active production orders on the floor</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-lg p-5 border border-gray-100">
                {/* Hero header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#00d4aa] rounded-lg flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-semibold text-gray-900 leading-tight">{heroOrder.formulations?.name || heroOrder.batch_number}</h3>
                      <p className="text-[12px] text-gray-500 mt-0.5">Current active line · {heroOrder.batch_number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Runtime</p>
                    <p className="text-[16px] font-mono font-semibold text-gray-900 tabular-nums">{runtimeStr}</p>
                  </div>
                </div>

                {/* 4 Metrics with progress bars */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {[
                    { label: 'Throughput', value: `${throughput.toLocaleString()} ${heroOrder.unit}/hr`, pct: Math.min(100, throughput / 10), color: '#00d4aa', icon: Zap },
                    { label: 'Yield', value: `${yieldPct}%`, pct: yieldPct, color: '#3b82f6', icon: Gauge },
                    { label: 'Progress', value: `${(heroOrder.actual_qty || 0).toLocaleString()} / ${heroOrder.planned_qty.toLocaleString()}`, pct: yieldPct, color: '#f59e0b', icon: Activity },
                    { label: 'Active Lines', value: `${liveOrders.filter(o => o.status === 'in_progress').length} Active`, pct: Math.min(100, liveOrders.filter(o => o.status === 'in_progress').length * 25), color: '#8b5cf6', icon: Users },
                  ].map(({ label, value, pct, color, icon: Icon }) => (
                    <div key={label}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon className="w-3 h-3 text-gray-400" />
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-[18px] font-semibold text-gray-900 mb-2 leading-tight">{value}</p>
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Stat Tiles - Matching Image 2 style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: String(stats.activeOrders).padStart(2, '0'), badge: stats.activeOrders > 0 ? 'running' : 'idle', sub: stats.activeOrders > 0 ? 'Production in progress' : 'No active runs', trend: stats.activeOrders > 0 ? 'up' : null },
          { label: 'Total Production', value: `${stats.totalProduction}`, badge: 't', sub: 'Cumulative output', trend: null },
          { label: 'Pending Dispatch', value: String(stats.pendingDispatches).padStart(2, '0'), badge: stats.pendingDispatches > 0 ? 'pending' : 'clear', sub: stats.pendingDispatches > 0 ? 'Awaiting shipment' : 'All dispatched', trend: null },
          { label: 'Efficiency', value: `${stats.efficiency}%`, badge: stats.efficiency >= 90 ? 'on target' : stats.efficiency >= 70 ? 'fair' : 'low', sub: 'Target: >85%', trend: stats.efficiency >= 90 ? 'up' : stats.efficiency < 70 ? 'down' : null },
        ].map(({ label, value, badge, sub, trend }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-3">{label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-[36px] font-semibold text-gray-900 tracking-tight leading-none">{value}</h3>
              {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {badge && <span className="text-[12px] text-gray-500 ml-1">{badge}</span>}
            </div>
            <p className="text-[12px] text-gray-500 mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts + Side Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Operations Trends */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 uppercase tracking-wide">Operations Trends</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Last 12 months</p>
            </div>
            <div className="flex items-center gap-5 text-[11px]">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#00d4aa] rounded-sm" /><span className="text-gray-500">Production</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /><span className="text-gray-500">Consumption</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-gray-300" /><span className="text-gray-500">Dispatch</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="production" fill="#00d4aa" radius={[4, 4, 0, 0]} name="Production (t)" />
              <Bar dataKey="consumption" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Consumption (t)" />
              <Line type="monotone" dataKey="dispatch" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Dispatch (t)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Stock Alerts */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-[13px] font-semibold text-gray-900 uppercase tracking-wide">Stock Alerts</h3>
              </div>
              <span className="text-[11px] text-gray-400">{filteredLowStock.length} items</span>
            </div>
            {filteredLowStock.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-6">All stock levels healthy</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {filteredLowStock.map(({ item, severity }) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.code}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-[12px] font-bold ${severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{item.current_stock.toLocaleString()} {item.unit}</p>
                      <div className={`flex items-center gap-1 justify-end mt-0.5 ${severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                        <TrendingDown className="w-3 h-3" />
                        <span className="text-[10px] capitalize">{severity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <PendingApprovalsWidget limit={5} compact />
          </div>
        </div>
      </div>

      {/* Recent Production Orders */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-gray-900 uppercase tracking-wide">Recent Production Orders</h2>
          <span className="text-[11px] text-gray-400">{recentOrders.length} orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3 text-left font-medium">Batch</th>
                <th className="px-5 py-3 text-left font-medium">Product</th>
                <th className="px-5 py-3 text-left font-medium">Planned</th>
                <th className="px-5 py-3 text-left font-medium">Actual</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-[13px]">No production orders found</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-gray-600">{order.batch_number}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-800 font-medium">{order.formulations?.name || '-'}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-600">{order.planned_qty} {order.unit}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-600">{order.actual_qty} {order.unit}</td>
                    <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-3 text-[12px] text-gray-400">{format(new Date(order.created_at), 'dd MMM yyyy')}</td>
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
