import { useState, useEffect, useMemo } from 'react';
import { Warehouse as WarehouseIcon, Package, AlertTriangle, ArrowUpDown, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { RawMaterial, Warehouse, StockMovement } from '../types/database';
import StatusBadge from '../components/ui/StatusBadge';
import StatCard from '../components/ui/StatCard';

type Tab = 'stock' | 'movements';
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'current_stock' | 'cost_per_unit'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moveType, setMoveType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [editingReorder, setEditingReorder] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState<string>('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === 'movements') fetchMovements(); }, [tab, dateFrom, dateTo, moveType]);

  async function fetchData() {
    setLoading(true);
    const [{ data: w }, { data: m }] = await Promise.all([
      supabase.from('warehouses').select('*').or('is_active.eq.true,is_active.is.null').order('name'),
      supabase.from('raw_materials').select('*, warehouses(*)').or('is_active.eq.true,is_active.is.null').order('name'),
    ]);
    setWarehouses(w || []);
    setMaterials(m || []);
    setLoading(false);
  }

  async function fetchMovements() {
    let q = supabase.from('stock_movements').select('*, raw_materials(*), formulations(*), warehouses(*)').order('movement_date', { ascending: false }).limit(200);
    if (dateFrom) q = q.gte('movement_date', dateFrom);
    if (dateTo) q = q.lte('movement_date', dateTo);
    if (moveType !== 'All') q = q.eq('movement_type', moveType.toLowerCase().replace(/ /g, '_'));
    const { data } = await q;
    setMovements(data || []);
  }

  const filtered = useMemo(() => {
    let list = materials;
    if (selectedWarehouse !== 'all') list = list.filter((m) => m.warehouse_id === selectedWarehouse);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [materials, selectedWarehouse, searchTerm, sortField, sortAsc]);

  const stats = useMemo(() => ({
    rawValue: materials.reduce((s, m) => s + m.current_stock * m.cost_per_unit, 0),
    lowCount: materials.filter((m) => m.current_stock > 0 && m.current_stock <= m.reorder_level).length,
    total: materials.length,
    whCount: warehouses.length,
  }), [materials, warehouses]);

  function toggleSort(f: typeof sortField) {
    if (sortField === f) setSortAsc(!sortAsc);
    else { setSortField(f); setSortAsc(true); }
  }

  function getStatus(m: RawMaterial) {
    if (m.current_stock === 0) return 'out_of_stock';
    return (m.current_stock <= m.reorder_level && m.reorder_level > 0) ? 'low_stock' : 'in_stock';
  }

  function stockPct(m: RawMaterial) {
    return m.reorder_level === 0 ? 100 : Math.min(100, Math.round((m.current_stock / (m.reorder_level * 2)) * 100));
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
        {(['stock', 'movements'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'stock' ? 'Stock Overview' : 'Stock Movements'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Raw Materials Value" value={`R ${stats.rawValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} icon={Package} color="teal" />
            <StatCard title="Total Finished Goods" value={stats.total} icon={WarehouseIcon} color="emerald" />
            <StatCard title="Low Stock Items" value={stats.lowCount} icon={AlertTriangle} color="amber" />
            <StatCard title="Warehouses" value={stats.whCount} icon={WarehouseIcon} color="teal" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search materials..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 ${inputCls}`} />
            </div>
            <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className={`px-4 py-2 ${inputCls}`}>
              <option value="all">All Warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className={`text-left ${thCls} cursor-pointer`} onClick={() => toggleSort('name')}>
                      <span className="inline-flex items-center gap-1">Material / Product <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-left ${thCls}`}>Code</th>
                    <th className={`text-left ${thCls}`}>Category</th>
                    <th className={`text-right ${thCls} cursor-pointer`} onClick={() => toggleSort('current_stock')}>
                      <span className="inline-flex items-center gap-1 justify-end">Current Stock <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-left ${thCls}`}>Unit</th>
                    <th className={`text-right ${thCls}`}>Reorder Level</th>
                    <th className={`text-right ${thCls} cursor-pointer`} onClick={() => toggleSort('cost_per_unit')}>
                      <span className="inline-flex items-center gap-1 justify-end">Value <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={`text-center ${thCls}`}>Stock Level</th>
                    <th className={`text-center ${thCls}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const st = getStatus(m);
                    return (
                      <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.code}</td>
                        <td className="px-4 py-3 text-slate-600">{m.category}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{m.current_stock.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500">{m.unit}</td>
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
                        <td className="px-4 py-3 text-right text-slate-800">R {(m.current_stock * m.cost_per_unit).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${statusBarColor[st]}`} style={{ width: `${stockPct(m)}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={st} /></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No materials found</td></tr>
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
