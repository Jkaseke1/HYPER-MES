import { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Circle, Play, Activity, Gauge, Users, Zap,
  Layers, Scale, Sparkles, ShieldCheck, Factory, Truck
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
  const [varianceAlerts, setVarianceAlerts] = useState<{ raw_material_name: string; stock_variance: number }[]>([]);
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
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const [ordersRes, materialsRes, formulationsRes, dispatchRes, recentRes, stockRes, trendRes, forecastRes, varianceRes] =
        await Promise.all([
          supabase.from('production_orders').select('planned_qty, actual_qty, status'),
          supabase.from('raw_materials').select('id', { count: 'exact', head: true }),
          supabase.from('formulations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('dispatch_orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'loading']),
          supabase.from('production_orders').select('*, formulations(name, code)').order('created_at', { ascending: false }).limit(10),
          supabase.from('raw_materials').select('id, name, code, unit, current_stock, reorder_level, alert_threshold_pct, days_of_cover_target').order('name'),
          supabase.from('monthly_operations_trends').select('*'),
          supabase.from('inventory_depletion_forecasts').select('*'),
          supabase.from('rm_daily_snapshots').select('raw_material_name, stock_variance').eq('snapshot_date', todayStr).gt('stock_variance', 0.1).order('stock_variance', { ascending: false }).limit(5),
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
      
      const allMaterials = (stockRes.data as RawMaterial[]) || [];
      setLowStockItems(allMaterials);
      setTrends((trendRes.data as MonthlyTrendRow[]) || []);
      setInventoryForecasts((forecastRes.data as InventoryForecastRow[]) || []);
      setVarianceAlerts((varianceRes.data as any[]) || []);
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
    const reorderLevel = Number(item.reorder_level || 0);
    const hasReorderLevel = reorderLevel > 0;
    const thresholdStock = reorderLevel * (1 + (item.alert_threshold_pct || 0.1));
    const belowLevel = hasReorderLevel ? item.current_stock <= thresholdStock : false;

    const daysToDepletion = forecast?.days_to_depletion;
    const targetCover = item.days_of_cover_target || 7;
    const belowDays = typeof daysToDepletion === 'number' && daysToDepletion > 0
      ? daysToDepletion <= targetCover
      : false;

    if (hasReorderLevel && belowLevel && belowDays) return 'critical';
    if (belowLevel || belowDays) return 'warning';
    return 'healthy';
  }

  const filteredLowStock = lowStockItems
    .map((item) => ({ item, severity: getSeverity(item), forecast: forecastMap[item.id] }))
    .filter(({ severity }) => severity !== 'healthy');

  const trendChartData = trends.map((row) => ({
    month: format(new Date(row.month), 'MMM yyyy'),
    production: Number(row.production_t || 0),
    consumption: Math.abs(Number(row.consumption_t || 0)),
    dispatch: Number(row.dispatch_t || 0),
  }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading Operations Command Center...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50/60 min-h-screen">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Factory className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Operations Command Center</h1>
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> Live MES Floor
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1.5">
                <span className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                  Raw Materials: <strong className="text-white">{stats.rawMaterialCount}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-blue-400 text-blue-400" />
                  Formulations: <strong className="text-white">{stats.formulationCount}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Circle className={`w-2 h-2 ${filteredLowStock.length > 0 ? 'fill-amber-400 text-amber-400' : 'fill-emerald-400 text-emerald-400'}`} />
                  Stock Alerts: <strong className={filteredLowStock.length > 0 ? 'text-amber-300' : 'text-emerald-300'}>{filteredLowStock.length}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Live Sync</p>
              <p className="text-xs font-mono font-bold text-slate-200">{format(lastUpdated, 'EEEE, MMM d · HH:mm:ss')}</p>
            </div>
            <button
              onClick={fetchLiveOrders}
              className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all text-white"
              title="Refresh Live Floor"
            >
              <RefreshCw className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Live Production Floor Card */}
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
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Manufacturing Floor Status</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Line Status:</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${isRunning ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : heroOrder ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {isRunning ? 'ACTIVE RUNNING' : heroOrder ? 'MATERIALS ISSUED' : 'NO ORDERS'}
                </span>
              </div>
            </div>

            {!heroOrder ? (
              <div className="bg-slate-50 rounded-2xl p-10 text-center border border-slate-200/60">
                <Factory className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No active production orders running on the floor</p>
                <p className="text-xs text-slate-400 mt-1">Start a new batch from Production Orders to view live telemetry.</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white tracking-tight">{heroOrder.formulations?.name || heroOrder.batch_number}</h3>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">Batch: {heroOrder.batch_number} • Main Manufacturing Line</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Runtime</span>
                    <p className="text-xl font-mono font-black text-emerald-400">{runtimeStr}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Throughput', value: `${throughput.toLocaleString()} ${heroOrder.unit}/hr`, pct: Math.min(100, throughput / 10), color: '#10b981', icon: Zap },
                    { label: 'Yield Rate', value: `${yieldPct}%`, pct: yieldPct, color: '#3b82f6', icon: Gauge },
                    { label: 'Batch Progress', value: `${(heroOrder.actual_qty || 0).toLocaleString()} / ${heroOrder.planned_qty.toLocaleString()} kg`, pct: yieldPct, color: '#f59e0b', icon: Activity },
                    { label: 'Active Lines', value: `${liveOrders.filter(o => o.status === 'in_progress').length} Line Running`, pct: Math.min(100, liveOrders.filter(o => o.status === 'in_progress').length * 50), color: '#a855f7', icon: Users },
                  ].map(({ label, value, pct, color, icon: Icon }) => (
                    <div key={label} className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
                      <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                      </div>
                      <p className="text-base font-extrabold text-white mb-2">{value}</p>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
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

      {/* KPI Stat Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Orders</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-slate-900 font-mono">{String(stats.activeOrders).padStart(2, '0')}</h3>
            {stats.activeOrders > 0 && <TrendingUp className="w-4 h-4 text-emerald-500" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats.activeOrders > 0 ? 'Batches in active queue' : 'No active runs'}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Production</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <h3 className="text-3xl font-extrabold text-slate-900 font-mono">{stats.totalProduction.toLocaleString()}</h3>
            <span className="text-xs font-bold text-slate-400">tonnes</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Cumulative plant output</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Dispatch</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-slate-900 font-mono">{String(stats.pendingDispatches).padStart(2, '0')}</h3>
            <span className="text-xs font-bold text-purple-600">trips</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats.pendingDispatches > 0 ? 'Shipments queueing' : 'All dispatched'}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Plant Efficiency</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-slate-900 font-mono">{stats.efficiency}%</h3>
            {stats.efficiency >= 85 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-amber-500" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">Target OEE: &gt;85%</p>
        </div>
      </div>

      {/* Analytics Charts & Stock Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        
        {/* Operations Trends Chart */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">12-Month Operations Trends & Analytics</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Production Output (t) vs RM Consumption vs Branch Dispatches</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Production</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded" /> Consumption</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-400 border-t border-dashed" /> Dispatch</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="production" fill="#10b981" radius={[6, 6, 0, 0]} name="Production (t)" />
              <Bar dataKey="consumption" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Consumption (t)" />
              <Line type="monotone" dataKey="dispatch" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Dispatch (t)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-5">
          {/* RM Variance Alert Banner */}
          {varianceAlerts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Raw Material Variance Alert</h3>
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">{varianceAlerts.length} Alerts</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {varianceAlerts.map((v) => (
                  <div key={v.raw_material_name} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-rose-100 shadow-sm">
                    <span className="font-semibold text-rose-900">{v.raw_material_name}</span>
                    <span className="font-mono font-extrabold text-rose-700">+{v.stock_variance.toFixed(3)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock & Reorder Alerts Widget */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stock & Reorder Alerts</h3>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{filteredLowStock.length} Alerts</span>
            </div>

            {filteredLowStock.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-700">All raw material stock levels healthy</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {filteredLowStock.map(({ item, severity, forecast }) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/70 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${severity === 'critical' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono font-bold text-blue-700">{item.code}</span>
                          {forecast?.days_to_depletion != null && (
                            <span className="text-amber-700 font-semibold">• {forecast.days_to_depletion.toFixed(1)} days left</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-xs font-extrabold font-mono ${severity === 'critical' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {item.current_stock.toLocaleString()} {item.unit}
                      </p>
                      <span className={`inline-block text-[9px] uppercase font-black px-1.5 py-0.5 rounded ${severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                        {severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <PendingApprovalsWidget limit={5} compact />
          </div>
        </div>
      </div>

      {/* Recent Production Orders Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Production Orders</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">{recentOrders.length} Recent Batches</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-left">Batch Number</th>
                <th className="px-5 py-3.5 text-left">Product Formulation</th>
                <th className="px-5 py-3.5 text-right">Planned (kg)</th>
                <th className="px-5 py-3.5 text-right">Actual (kg)</th>
                <th className="px-5 py-3.5 text-left">Status</th>
                <th className="px-5 py-3.5 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">No production orders found</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{order.batch_number}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{order.formulations?.name || '-'}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-700">{order.planned_qty?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700">{order.actual_qty?.toLocaleString()}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-3.5 text-slate-500">{format(new Date(order.created_at), 'dd MMM yyyy')}</td>
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
