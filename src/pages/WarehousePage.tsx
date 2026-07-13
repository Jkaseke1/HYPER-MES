import { useState, useEffect, useMemo } from 'react';
import { Warehouse as WarehouseIcon, Package, AlertTriangle, ArrowUpDown, Search, Filter, Check } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { RawMaterial, StockMovement } from '../types/database';
import StatusBadge from '../components/ui/StatusBadge';
import StatCard from '../components/ui/StatCard';

type Tab = 'stock' | 'buffer' | 'movements';
const MOVE_TYPES = ['All', 'Receipt', 'Issue', 'Transfer', 'Production Input', 'Production Output', 'Dispatch'];
const statusBarColor: Record<string, string> = { in_stock: 'bg-emerald-500', low_stock: 'bg-amber-500', out_of_stock: 'bg-red-500' };
const mvBadge: Record<string, string> = {
  receipt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  issue: 'bg-red-50 text-red-700 border-red-200',
  transfer: 'bg-teal-50 text-teal-700 border-teal-200',
  production_input: 'bg-amber-50 text-amber-700 border-amber-200',
  production_output: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dispatch: 'bg-slate-50 text-slate-700 border-slate-200',
};
const thCls = 'px-4 py-3 font-semibold text-slate-600';
const inputCls = 'border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';

export default function WarehousePage() {
  const [tab, setTab] = useState<Tab>('stock');
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [bufferBalances, setBufferBalances] = useState<any[]>([]);
  const [rmWarehouseBalances, setRmWarehouseBalances] = useState<Record<string, number>>({});
  const [productionWarehouseBalances, setProductionWarehouseBalances] = useState<Record<string, number>>({});
  const [productionTransferTotals, setProductionTransferTotals] = useState<Record<string, number>>({});
  const [productionTransferMtd, setProductionTransferMtd] = useState<Record<string, number>>({});
  const [bufferSearchTerm, setBufferSearchTerm] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'rm_balance' | 'sent_mtd'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moveType, setMoveType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [editingReorder, setEditingReorder] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState<string>('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === 'movements') fetchMovements(); }, [tab, dateFrom, dateTo, moveType]);
  useEffect(() => { if (tab === 'buffer') fetchBufferBalances(); }, [tab]);

  useEffect(() => {
    const channel = supabase
      .channel('warehouse-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock_balances' }, () => {
        fetchData(true);
        if (tab === 'buffer') fetchBufferBalances();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
        fetchData(true);
        if (tab === 'movements') fetchMovements();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_transfers' }, () => {
        fetchData(true);
      })
      .subscribe();

    const intervalId = window.setInterval(() => {
      fetchData(true);
      if (tab === 'buffer') fetchBufferBalances();
      if (tab === 'movements') fetchMovements();
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [tab, dateFrom, dateTo, moveType]);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      { data: m },
      { data: rmBalances },
      { data: prodBalances },
      { data: transferOutMovements }
    ] = await Promise.all([
      supabase.from('raw_materials').select('*, warehouses(*)').or('is_active.eq.true,is_active.is.null').order('name'),
      supabase
        .from('warehouse_stock_balances')
        .select('raw_material_id, quantity, warehouses!inner(code)')
        .eq('warehouses.code', 'RM'),
      supabase
        .from('warehouse_stock_balances')
        .select('raw_material_id, quantity, warehouses!inner(code)')
        .in('warehouses.code', ['PROD', 'PRODUCTION']),
      supabase
        .from('stock_movements')
        .select('raw_material_id, quantity, movement_date, warehouses!inner(code)')
        .eq('movement_type', 'transfer')
        .eq('reference_type', 'material_transfer')
        .lt('quantity', 0)
        .eq('warehouses.code', 'RM')
        .limit(5000),
    ]);

    setMaterials(m || []);

    const rmMap: Record<string, number> = {};
    (rmBalances || []).forEach((b: any) => {
      rmMap[b.raw_material_id] = Number(b.quantity || 0);
    });
    setRmWarehouseBalances(rmMap);

    const prodMap: Record<string, number> = {};
    (prodBalances || []).forEach((b: any) => {
      prodMap[b.raw_material_id] = Number(b.quantity || 0);
    });
    setProductionWarehouseBalances(prodMap);

    const totalMap: Record<string, number> = {};
    const mtdMap: Record<string, number> = {};
    (transferOutMovements || []).forEach((mv: any) => {
      if (!mv.raw_material_id) return;
      const qty = Math.abs(Number(mv.quantity || 0));
      totalMap[mv.raw_material_id] = (totalMap[mv.raw_material_id] || 0) + qty;

      if (mv.movement_date && new Date(mv.movement_date) >= startOfMonth) {
        mtdMap[mv.raw_material_id] = (mtdMap[mv.raw_material_id] || 0) + qty;
      }
    });
    setProductionTransferTotals(totalMap);
    setProductionTransferMtd(mtdMap);

    if (!silent) setLoading(false);
  }

  async function fetchMovements() {
    let q = supabase.from('stock_movements').select('*, raw_materials(*), formulations(*), warehouses(*)').order('movement_date', { ascending: false }).limit(200);
    if (dateFrom) q = q.gte('movement_date', dateFrom);
    if (dateTo) q = q.lte('movement_date', dateTo);
    if (moveType !== 'All') q = q.eq('movement_type', moveType.toLowerCase().replace(/ /g, '_'));
    const { data } = await q;
    setMovements(data || []);
  }

  async function fetchBufferBalances() {
    const { data } = await supabase
      .from('warehouse_stock_balances')
      .select('*, raw_materials(*), warehouses(*)')
      .eq('raw_materials.is_active', true)
      .eq('warehouses.code', 'BUFFER')
      .gt('quantity', 0)
      .order('updated_at', { ascending: false });
    setBufferBalances(data || []);
  }

  const rmRows = useMemo(() => {
    let list = materials.map((m) => ({
      ...m,
      rm_balance: rmWarehouseBalances[m.id] ?? 0,
      prod_balance: productionWarehouseBalances[m.id] ?? 0,
      sent_total: productionTransferTotals[m.id] ?? 0,
      sent_mtd: productionTransferMtd[m.id] ?? 0,
    }));

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [materials, rmWarehouseBalances, productionWarehouseBalances, productionTransferTotals, productionTransferMtd, searchTerm, sortField, sortAsc]);

  const stats = useMemo(() => ({
    rmValue: materials.reduce((s, m) => s + ((rmWarehouseBalances[m.id] || 0) * m.cost_per_unit), 0),
    sentMtd: materials.reduce((s, m) => s + (productionTransferMtd[m.id] || 0), 0),
    lowCount: materials.filter((m) => {
      const rm = rmWarehouseBalances[m.id] || 0;
      return rm > 0 && rm <= m.reorder_level;
    }).length,
    stockedCount: materials.filter((m) => (rmWarehouseBalances[m.id] || 0) > 0).length,
    total: materials.length,
  }), [materials, rmWarehouseBalances, productionTransferMtd]);

  function toggleSort(f: 'name' | 'rm_balance' | 'sent_mtd') {
    if (sortField === f) setSortAsc(!sortAsc);
    else { setSortField(f); setSortAsc(true); }
  }

  function getStatus(rmBalance: number, reorderLevel: number) {
    if (rmBalance === 0) return 'out_of_stock';
    return (rmBalance <= reorderLevel && reorderLevel > 0) ? 'low_stock' : 'in_stock';
  }

  function stockPct(rmBalance: number, reorderLevel: number) {
    return reorderLevel === 0 ? 100 : Math.min(100, Math.round((rmBalance / (reorderLevel * 2)) * 100));
  }

  // Handle reorder level editing
  const startEditingReorder = (materialId: string, currentValue: number) => {
    setEditingReorder(materialId);
    setReorderValue(currentValue.toString());
  };

  const saveReorderLevel = async (materialId: string) => {
    const newReorderLevel = parseFloat(reorderValue) || 0;
    
    try {
      const { error } = await supabase
        .from('raw_materials')
        .update({ reorder_level: newReorderLevel })
        .eq('id', materialId);

      if (error) throw error;

      // Update local state
      setMaterials(materials.map(m => 
        m.id === materialId ? { ...m, reorder_level: newReorderLevel } : m
      ));

      setEditingReorder(null);
      setReorderValue('');
    } catch (error: any) {
      console.error('Error updating reorder level:', error);
      alert('Failed to update reorder level');
    }
  };

  const cancelEditingReorder = () => {
    setEditingReorder(null);
    setReorderValue('');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Warehouse Management</h1>
        <p className="text-sm text-slate-500 mt-1">Monitor stock levels and track material movements</p>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['stock', 'buffer', 'movements'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'stock' ? 'Stock Overview' : t === 'buffer' ? 'Buffer / Holding Bay' : 'Stock Movements'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="RM On Hand Value" value={`$ ${stats.rmValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon={Package} color="teal" />
            <StatCard title="Sent to Production (MTD)" value={`${stats.sentMtd.toLocaleString()} kg`} icon={ArrowUpDown} color="amber" />
            <StatCard title="Low RM Stock Items" value={stats.lowCount} icon={AlertTriangle} color="red" />
            <StatCard title="Materials with RM Stock" value={stats.stockedCount} icon={WarehouseIcon} color="emerald" />
          </div>
          <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3">
            <p className="text-sm font-medium text-teal-900">RM Warehouse Control View</p>
            <p className="text-xs text-teal-700 mt-1">Track what remains in Raw Materials warehouse and exactly what has been deducted to production.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search materials..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 ${inputCls}`} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`text-left ${thCls} cursor-pointer`} onClick={() => toggleSort('name')}>
                      <span className="inline-flex items-center gap-1">Material <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-left ${thCls}`}>Code</th>
                    <th className={`text-left ${thCls}`}>Unit</th>
                    <th className={`text-right ${thCls} cursor-pointer`} onClick={() => toggleSort('rm_balance')}>
                      <span className="inline-flex items-center gap-1 justify-end">RM On Hand <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-right ${thCls} cursor-pointer`} onClick={() => toggleSort('sent_mtd')}>
                      <span className="inline-flex items-center gap-1 justify-end">Deducted to Production (MTD) <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-right ${thCls}`}>Deducted to Production (All Time)</th>
                    <th className={`text-right ${thCls}`}>Production Warehouse</th>
                    <th className={`text-right ${thCls}`}>Reorder Level</th>
                    <th className={`text-center ${thCls}`}>Stock Level</th>
                    <th className={`text-center ${thCls}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rmRows.map((m) => {
                    const st = getStatus(m.rm_balance, m.reorder_level);
                    return (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.code}</td>
                        <td className="px-4 py-3 text-slate-500">{m.unit}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{m.rm_balance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">{m.sent_mtd.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{m.sent_total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-teal-700">{m.prod_balance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {editingReorder === m.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                step="0.01"
                                value={reorderValue}
                                onChange={(e) => setReorderValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveReorderLevel(m.id);
                                  if (e.key === 'Escape') cancelEditingReorder();
                                }}
                                className="w-20 px-2 py-1 text-right border border-teal-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                                autoFocus
                              />
                              <button
                                onClick={() => saveReorderLevel(m.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={cancelEditingReorder}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingReorder(m.id, m.reorder_level)}
                              className="text-right text-slate-500 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded text-sm transition-colors"
                              title="Click to edit reorder level"
                            >
                              {m.reorder_level.toLocaleString()}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${statusBarColor[st]}`} style={{ width: `${stockPct(m.rm_balance, m.reorder_level)}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={st} /></td>
                      </tr>
                    );
                  })}
                  {rmRows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No materials found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'buffer' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Buffer Items" value={bufferBalances.length} icon={Package} color="teal" />
            <StatCard title="Total Buffer Quantity" value={bufferBalances.reduce((s, b) => s + (b.quantity || 0), 0).toLocaleString()} icon={WarehouseIcon} color="amber" />
            <StatCard title="Buffer Warehouse" value="BUFFER" icon={WarehouseIcon} color="emerald" />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search buffer materials..." value={bufferSearchTerm} onChange={(e) => setBufferSearchTerm(e.target.value)} className={`w-full max-w-md pl-10 pr-4 py-2 ${inputCls}`} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`text-left ${thCls}`}>Material</th>
                    <th className={`text-left ${thCls}`}>Code</th>
                    <th className={`text-left ${thCls}`}>Unit</th>
                    <th className={`text-right ${thCls}`}>Quantity in Buffer</th>
                    <th className={`text-left ${thCls}`}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {bufferBalances
                    .filter((b) => {
                      if (!bufferSearchTerm) return true;
                      const q = bufferSearchTerm.toLowerCase();
                      const name = (b.raw_materials?.name || '').toLowerCase();
                      const code = (b.raw_materials?.code || '').toLowerCase();
                      return name.includes(q) || code.includes(q);
                    })
                    .map((b) => (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{b.raw_materials?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{b.raw_materials?.code || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{b.raw_materials?.unit || 'kg'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{(b.quantity || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500">{b.updated_at ? format(new Date(b.updated_at), 'dd MMM yyyy HH:mm') : '-'}</td>
                      </tr>
                    ))}
                  {bufferBalances.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No materials currently in Buffer / Holding Bay</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'movements' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`px-3 py-2 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`px-3 py-2 ${inputCls}`} />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select value={moveType} onChange={(e) => setMoveType(e.target.value)} className={`pl-10 pr-4 py-2 ${inputCls} appearance-none bg-white`}>
                {MOVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`text-left ${thCls}`}>Date</th>
                    <th className={`text-left ${thCls}`}>Type</th>
                    <th className={`text-left ${thCls}`}>Material / Product</th>
                    <th className={`text-left ${thCls}`}>Warehouse</th>
                    <th className={`text-right ${thCls}`}>Quantity</th>
                    <th className={`text-left ${thCls}`}>Batch Number</th>
                    <th className={`text-left ${thCls}`}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mv) => {
                    const badge = mvBadge[mv.movement_type] || 'bg-slate-50 text-slate-600 border-slate-200';
                    const label = mv.movement_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <tr key={mv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{format(new Date(mv.movement_date), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${badge}`}>{label}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{mv.raw_materials?.name || mv.formulations?.name || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{mv.warehouses?.name || '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{mv.quantity.toLocaleString()} {mv.unit}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{mv.batch_number || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{mv.notes || '-'}</td>
                      </tr>
                    );
                  })}
                  {movements.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No movements found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
