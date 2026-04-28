import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, Play, CheckCircle, AlertTriangle, Package, Clock, Factory } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import StatCard from '../components/ui/StatCard';
import { validateStockAvailability, StockError } from '../lib/stockValidation';
import StockErrorBanner from '../components/stock/StockErrorBanner';
import StockOverrideModal from '../components/stock/StockOverrideModal';

/* ── Types ── */
interface MacropackBom {
  id: string;
  macropack_code: string;
  macropack_name: string;
  version: number;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  ingredientCount?: number;
}

interface BomIngredient {
  id: string;
  macropack_bom_id: string;
  raw_material_id: string;
  grams_per_unit: number;
  raw_materials?: { id: string; code: string; name: string };
}

interface ManufactureOrder {
  id: string;
  macropack_bom_id: string;
  planned_units: number;
  actual_units: number | null;
  manufacture_date: string;
  manufactured_by: string | null;
  status: string;
  created_at: string;
  macropack_boms?: { macropack_code: string; macropack_name: string };
}

interface IssueRow {
  id?: string;
  raw_material_id: string;
  ingredient_name: string;
  ingredient_code: string;
  expected_grams: number;
  actual_grams_dispensed: number | string;
  variance_grams: number | null;
  variance_pct: number | null;
}

interface RawMaterial {
  id: string;
  code: string;
  name: string;
}

/* ── Constants ── */
const TABS = ['Manufacturing Orders', 'Macropack BOMs'] as const;
type TabType = typeof TABS[number];

const STATUS_STYLES: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

const emptyBomForm = {
  macropack_code: '',
  macropack_name: '',
  version: 1,
  effective_from: '',
  effective_to: '',
};

const emptyOrderForm = {
  macropack_bom_id: '',
  planned_units: '',
  manufacture_date: new Date().toISOString().split('T')[0],
};

export default function MacropackManufacturingPage() {
  useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('Manufacturing Orders');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Data
  const [boms, setBoms] = useState<MacropackBom[]>([]);
  const [orders, setOrders] = useState<ManufactureOrder[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);

  // Modals
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [orderDetailModalOpen, setOrderDetailModalOpen] = useState(false);
  const [newBomModalOpen, setNewBomModalOpen] = useState(false);
  const [viewBomModalOpen, setViewBomModalOpen] = useState(false);

  // Forms
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [bomForm, setBomForm] = useState(emptyBomForm);
  const [bomIngredients, setBomIngredients] = useState<{ raw_material_id: string; grams_per_unit: string }[]>([]);

  // Detail view
  const [selectedOrder, setSelectedOrder] = useState<ManufactureOrder | null>(null);
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [selectedBom, setSelectedBom] = useState<MacropackBom | null>(null);
  const [selectedBomIngredients, setSelectedBomIngredients] = useState<BomIngredient[]>([]);

  // Preview for new order
  const [previewIngredients, setPreviewIngredients] = useState<{ name: string; code: string; expected_grams: number }[]>([]);

  // Stock validation
  const [stockErrors, setStockErrors] = useState<StockError[]>([]);
  const [showStockOverride, setShowStockOverride] = useState(false);
  const [pendingCompleteCallback, setPendingCompleteCallback] = useState<(() => Promise<void>) | null>(null);

  async function fetchData() {
    setLoading(true);
    const [bomsRes, ordersRes, materialsRes] = await Promise.all([
      supabase.from('macropack_boms').select('*').order('macropack_name'),
      supabase.from('macropack_manufacture_orders').select('*, macropack_boms(macropack_code, macropack_name)').order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('id, code, name').eq('is_active', true).order('name'),
    ]);

    // Count ingredients per BOM
    const bomData = bomsRes.data || [];
    if (bomData.length > 0) {
      const { data: ingCounts } = await supabase
        .from('macropack_bom_ingredients')
        .select('macropack_bom_id');
      const countMap: Record<string, number> = {};
      (ingCounts || []).forEach((i: any) => {
        countMap[i.macropack_bom_id] = (countMap[i.macropack_bom_id] || 0) + 1;
      });
      bomData.forEach(b => { b.ingredientCount = countMap[b.id] || 0; });
    }

    setBoms(bomData);
    setOrders(ordersRes.data || []);
    setMaterials(materialsRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  /* ── Tab 1: Manufacturing Orders ── */
  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      o.macropack_boms?.macropack_name?.toLowerCase().includes(q) ||
      o.macropack_boms?.macropack_code?.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const orderStats = useMemo(() => ({
    total: orders.length,
    planned: orders.filter(o => o.status === 'PLANNED').length,
    inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
    completed: orders.filter(o => o.status === 'COMPLETED').length,
  }), [orders]);

  // Update preview when BOM or units change
  async function updatePreview(bomId: string, units: string) {
    if (!bomId || !units || parseInt(units) <= 0) {
      setPreviewIngredients([]);
      return;
    }
    const { data: ings } = await supabase
      .from('macropack_bom_ingredients')
      .select('grams_per_unit, raw_materials(code, name)')
      .eq('macropack_bom_id', bomId);

    const plannedUnits = parseInt(units);
    setPreviewIngredients((ings || []).map((i: any) => ({
      name: i.raw_materials?.name || 'Unknown',
      code: i.raw_materials?.code || '',
      expected_grams: i.grams_per_unit * plannedUnits,
    })));
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderForm.macropack_bom_id || !orderForm.planned_units) {
      alert('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('macropack_manufacture_orders').insert({
        macropack_bom_id: orderForm.macropack_bom_id,
        planned_units: parseInt(orderForm.planned_units),
        manufacture_date: orderForm.manufacture_date,
        manufactured_by: user?.id || null,
        status: 'PLANNED',
      });
      if (error) throw error;
      setNewOrderModalOpen(false);
      setOrderForm(emptyOrderForm);
      setPreviewIngredients([]);
      fetchData();
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function openOrderDetail(order: ManufactureOrder) {
    setSelectedOrder(order);
    setOrderDetailModalOpen(true);

    // Fetch BOM ingredients to build issue rows
    const { data: ings } = await supabase
      .from('macropack_bom_ingredients')
      .select('raw_material_id, grams_per_unit, raw_materials(code, name)')
      .eq('macropack_bom_id', order.macropack_bom_id);

    // Fetch existing issues
    const { data: existingIssues } = await supabase
      .from('macropack_manufacture_issues')
      .select('*')
      .eq('manufacture_order_id', order.id);

    const issueMap: Record<string, any> = {};
    (existingIssues || []).forEach((ei: any) => { issueMap[ei.raw_material_id] = ei; });

    const rows: IssueRow[] = (ings || []).map((i: any) => {
      const expectedGrams = i.grams_per_unit * (order.planned_units || 0);
      const existing = issueMap[i.raw_material_id];
      const actual = existing?.actual_grams_dispensed ?? '';
      const actualNum = typeof actual === 'number' ? actual : parseFloat(actual as string);
      const variance = !isNaN(actualNum) && actual !== '' ? actualNum - expectedGrams : null;
      const variancePct = variance !== null && expectedGrams > 0 ? (variance / expectedGrams) * 100 : null;

      return {
        id: existing?.id,
        raw_material_id: i.raw_material_id,
        ingredient_name: i.raw_materials?.name || 'Unknown',
        ingredient_code: i.raw_materials?.code || '',
        expected_grams: expectedGrams,
        actual_grams_dispensed: existing?.actual_grams_dispensed ?? '',
        variance_grams: variance,
        variance_pct: variancePct,
      };
    });

    setIssueRows(rows);
  }

  function handleIssueChange(rmId: string, value: string) {
    setIssueRows(prev => prev.map(r => {
      if (r.raw_material_id !== rmId) return r;
      const actual = value === '' ? '' : value;
      const actualNum = parseFloat(value);
      const variance = !isNaN(actualNum) && value !== '' ? actualNum - r.expected_grams : null;
      const variancePct = variance !== null && r.expected_grams > 0 ? (variance / r.expected_grams) * 100 : null;
      return { ...r, actual_grams_dispensed: actual, variance_grams: variance, variance_pct: variancePct };
    }));
  }

  async function handleStartOrder() {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('macropack_manufacture_orders')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setSelectedOrder({ ...selectedOrder, status: 'IN_PROGRESS' });
      fetchData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteOrder() {
    if (!selectedOrder) return;

    // Check for high variances (> 2%)
    const highVariances = issueRows.filter(r =>
      r.variance_pct !== null && Math.abs(r.variance_pct) > 2
    );
    if (highVariances.length > 0) {
      const names = highVariances.map(r => `${r.ingredient_code} (${r.variance_pct!.toFixed(1)}%)`).join(', ');
      if (!confirm(`Warning: ${highVariances.length} ingredient(s) have variance > 2%:\n${names}\n\nContinue with completion?`)) {
        return;
      }
    }

    // Validate stock availability for all ingredients
    const ingredientsToCheck = issueRows.map(r => ({
      raw_material_id: r.raw_material_id,
      quantity: r.expected_grams / 1000, // Convert grams to kg
      name: r.ingredient_name
    }));

    const stockCheck = await validateStockAvailability(ingredientsToCheck);
    if (!stockCheck.isValid) {
      setStockErrors(stockCheck.errors);
      setPendingCompleteCallback(() => async () => {
        await completeOrderTransaction();
      });
      setShowStockOverride(true);
      return;
    }

    setSaving(true);
    await completeOrderTransaction();
  }

  async function completeOrderTransaction() {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Upsert issue rows
      const issueData = issueRows
        .filter(r => r.actual_grams_dispensed !== '' && r.actual_grams_dispensed !== null)
        .map(r => ({
          manufacture_order_id: selectedOrder.id,
          raw_material_id: r.raw_material_id,
          expected_grams: r.expected_grams,
          actual_grams_dispensed: parseFloat(String(r.actual_grams_dispensed)),
          dispensed_at: new Date().toISOString(),
        }));

      if (issueData.length > 0) {
        // Delete existing issues and re-insert
        await supabase
          .from('macropack_manufacture_issues')
          .delete()
          .eq('manufacture_order_id', selectedOrder.id);

        const { error: issueError } = await supabase
          .from('macropack_manufacture_issues')
          .insert(issueData);
        if (issueError) throw issueError;
      }

      // Update order status
      const { error } = await supabase
        .from('macropack_manufacture_orders')
        .update({
          status: 'COMPLETED',
          actual_units: selectedOrder.planned_units,
          manufactured_by: user?.id || null,
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;

      setOrderDetailModalOpen(false);
      setSelectedOrder(null);
      fetchData();
    } catch (error: any) {
      console.error('Error completing order:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  /* ── Tab 2: Macropack BOMs ── */
  const filteredBoms = useMemo(() => {
    if (!search) return boms;
    const q = search.toLowerCase();
    return boms.filter(b =>
      b.macropack_code.toLowerCase().includes(q) ||
      b.macropack_name.toLowerCase().includes(q)
    );
  }, [boms, search]);

  async function openViewBom(bom: MacropackBom) {
    setSelectedBom(bom);
    const { data } = await supabase
      .from('macropack_bom_ingredients')
      .select('*, raw_materials(id, code, name)')
      .eq('macropack_bom_id', bom.id)
      .order('created_at');
    setSelectedBomIngredients(data || []);
    setViewBomModalOpen(true);
  }

  function openNewBom() {
    setBomForm(emptyBomForm);
    setBomIngredients([{ raw_material_id: '', grams_per_unit: '' }]);
    setNewBomModalOpen(true);
  }

  function addBomIngredientRow() {
    setBomIngredients(prev => [...prev, { raw_material_id: '', grams_per_unit: '' }]);
  }

  function removeBomIngredientRow(idx: number) {
    setBomIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCreateBom(e: React.FormEvent) {
    e.preventDefault();
    if (!bomForm.macropack_code || !bomForm.macropack_name) {
      alert('Please fill in code and name.');
      return;
    }
    const validIngs = bomIngredients.filter(i => i.raw_material_id && i.grams_per_unit);
    if (validIngs.length === 0) {
      alert('Please add at least one ingredient.');
      return;
    }
    setSaving(true);
    try {
      const { data: bomData, error: bomError } = await supabase
        .from('macropack_boms')
        .insert({
          macropack_code: bomForm.macropack_code,
          macropack_name: bomForm.macropack_name,
          version: bomForm.version,
          effective_from: bomForm.effective_from || null,
          effective_to: bomForm.effective_to || null,
        })
        .select('id')
        .single();
      if (bomError) throw bomError;

      const ingData = validIngs.map(i => ({
        macropack_bom_id: bomData.id,
        raw_material_id: i.raw_material_id,
        grams_per_unit: parseFloat(i.grams_per_unit),
      }));
      const { error: ingError } = await supabase.from('macropack_bom_ingredients').insert(ingData);
      if (ingError) throw ingError;

      setNewBomModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating BOM:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Macropack Manufacturing</h1>
          <p className="text-sm text-slate-500 mt-1">Manage macropack BOMs and manufacturing orders</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'Manufacturing Orders' && (
            <button onClick={() => { setOrderForm(emptyOrderForm); setPreviewIngredients([]); setNewOrderModalOpen(true); }}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> New Order
            </button>
          )}
          {activeTab === 'Macropack BOMs' && (
            <button onClick={openNewBom}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> Add New BOM
            </button>
          )}
        </div>
      </div>

      {/* Stats (Orders tab) */}
      {activeTab === 'Manufacturing Orders' && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard title="Total Orders" value={orderStats.total} icon={Package} />
          <StatCard title="Planned" value={orderStats.planned} icon={Clock} color="slate" />
          <StatCard title="In Progress" value={orderStats.inProgress} icon={Factory} color="blue" />
          <StatCard title="Completed" value={orderStats.completed} icon={CheckCircle} color="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder={activeTab === 'Manufacturing Orders' ? 'Search orders...' : 'Search BOMs...'}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
      </div>

      {/* ── Tab 1: Manufacturing Orders ── */}
      {activeTab === 'Manufacturing Orders' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Macropack</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Planned Qty (kg)</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Manufacture Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No orders found</td></tr>
                ) : filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{o.macropack_boms?.macropack_name}</div>
                      <div className="text-xs text-slate-500">{o.macropack_boms?.macropack_code}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700">{o.planned_units?.toLocaleString()} <span className="text-xs text-slate-400">kg</span></td>
                    <td className="px-4 py-3 text-slate-600">{o.manufacture_date ? format(new Date(o.manufacture_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[o.status] || ''}`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openOrderDetail(o)}
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium">
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Macropack BOMs ── */}
      {activeTab === 'Macropack BOMs' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Version</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Active</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Ingredients</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBoms.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No BOMs found</td></tr>
                ) : filteredBoms.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">{b.macropack_code}</td>
                    <td className="px-4 py-3 text-slate-700">{b.macropack_name}</td>
                    <td className="px-4 py-3 text-center text-slate-600">v{b.version}</td>
                    <td className="px-4 py-3 text-center">
                      {b.is_active
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{b.ingredientCount}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openViewBom(b)}
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium">
                        <Eye className="w-3.5 h-3.5" /> View BOM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── New Order Modal ── */}
      <Modal open={newOrderModalOpen} onClose={() => setNewOrderModalOpen(false)} title="New Manufacturing Order">
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className={labelCls}>Macropack *</label>
            <select value={orderForm.macropack_bom_id}
              onChange={(e) => { setOrderForm({ ...orderForm, macropack_bom_id: e.target.value }); updatePreview(e.target.value, orderForm.planned_units); }}
              className={inputCls} required>
              <option value="">Select macropack</option>
              {boms.filter(b => b.is_active).map(b => (
                <option key={b.id} value={b.id}>{b.macropack_code} — {b.macropack_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Planned Quantity (kg) *</label>
              <input type="number" min="1" value={orderForm.planned_units}
                onChange={(e) => { setOrderForm({ ...orderForm, planned_units: e.target.value }); updatePreview(orderForm.macropack_bom_id, e.target.value); }}
                className={inputCls} placeholder="e.g. 500" required />
            </div>
            <div>
              <label className={labelCls}>Manufacture Date *</label>
              <input type="date" value={orderForm.manufacture_date}
                onChange={(e) => setOrderForm({ ...orderForm, manufacture_date: e.target.value })}
                className={inputCls} required />
            </div>
          </div>

          {/* Ingredient Preview */}
          {previewIngredients.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">Expected Ingredients</div>
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-slate-500">Code</th>
                    <th className="px-3 py-1.5 text-left text-slate-500">Ingredient</th>
                    <th className="px-3 py-1.5 text-right text-slate-500">Expected (g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewIngredients.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{p.code}</td>
                      <td className="px-3 py-1.5 text-slate-600">{p.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{p.expected_grams.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setNewOrderModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Order Detail Modal ── */}
      <Modal open={orderDetailModalOpen} onClose={() => { setOrderDetailModalOpen(false); setSelectedOrder(null); }}
        title={selectedOrder ? `Order: ${selectedOrder.macropack_boms?.macropack_name || ''}` : 'Order Details'}>
        {selectedOrder && (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500">Macropack</span>
                <p className="font-medium text-slate-800">{selectedOrder.macropack_boms?.macropack_code} — {selectedOrder.macropack_boms?.macropack_name}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Planned Qty (kg)</span>
                <p className="font-medium text-slate-800">{selectedOrder.planned_units?.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Status</span>
                <p><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[selectedOrder.status]}`}>{selectedOrder.status.replace('_', ' ')}</span></p>
              </div>
            </div>

            {/* Layers note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 text-amber-600" />
              <strong>Layers products:</strong> Limestone flour added directly to plant at 45kg/tonne — record as direct RM issue at batch level.
            </div>

            {/* Ingredients Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Ingredient</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Expected (g)</th>
                    <th className="px-3 py-2 text-right font-medium text-teal-700 min-w-[110px]">Actual (g)</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Variance (g)</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Var %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issueRows.map(row => {
                    const hasHighVar = row.variance_pct !== null && Math.abs(row.variance_pct) > 2;
                    return (
                      <tr key={row.raw_material_id} className={hasHighVar ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2 font-mono text-slate-700">{row.ingredient_code}</td>
                        <td className="px-3 py-2 text-slate-600">{row.ingredient_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.expected_grams.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">
                          {selectedOrder.status !== 'COMPLETED' ? (
                            <input type="number" step="0.01" value={row.actual_grams_dispensed}
                              onChange={(e) => handleIssueChange(row.raw_material_id, e.target.value)}
                              className="w-full text-right border border-teal-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none bg-teal-50"
                              placeholder="Enter actual" />
                          ) : (
                            <span className="tabular-nums">{row.actual_grams_dispensed !== '' ? Number(row.actual_grams_dispensed).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                          row.variance_grams !== null ? (row.variance_grams < 0 ? 'text-red-600' : row.variance_grams > 0 ? 'text-amber-600' : 'text-slate-400') : 'text-slate-400'
                        }`}>
                          {row.variance_grams !== null ? row.variance_grams.toFixed(2) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${hasHighVar ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                          {row.variance_pct !== null ? `${row.variance_pct.toFixed(1)}%` : '—'}
                          {hasHighVar && <AlertTriangle className="w-3 h-3 inline-block ml-1 text-amber-500" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED' && (
              <div className="flex justify-end gap-3 pt-2">
                {selectedOrder.status === 'PLANNED' && (
                  <button onClick={handleStartOrder} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Play className="w-4 h-4" /> {saving ? 'Starting...' : 'Start Production'}
                  </button>
                )}
                {(selectedOrder.status === 'IN_PROGRESS' || selectedOrder.status === 'PLANNED') && (
                  <button onClick={handleCompleteOrder} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" /> {saving ? 'Completing...' : 'Complete Order'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── New BOM Modal ── */}
      <Modal open={newBomModalOpen} onClose={() => setNewBomModalOpen(false)} title="Create Macropack BOM">
        <form onSubmit={handleCreateBom} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Macropack Code *</label>
              <input type="text" value={bomForm.macropack_code}
                onChange={(e) => setBomForm({ ...bomForm, macropack_code: e.target.value })}
                className={inputCls} placeholder="e.g. MP-BSC" required />
            </div>
            <div>
              <label className={labelCls}>Macropack Name *</label>
              <input type="text" value={bomForm.macropack_name}
                onChange={(e) => setBomForm({ ...bomForm, macropack_name: e.target.value })}
                className={inputCls} placeholder="e.g. Broiler Starter Micro Pack" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Version</label>
              <input type="number" min="1" value={bomForm.version}
                onChange={(e) => setBomForm({ ...bomForm, version: parseInt(e.target.value) || 1 })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Effective From</label>
              <input type="date" value={bomForm.effective_from}
                onChange={(e) => setBomForm({ ...bomForm, effective_from: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Effective To</label>
              <input type="date" value={bomForm.effective_to}
                onChange={(e) => setBomForm({ ...bomForm, effective_to: e.target.value })}
                className={inputCls} />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Ingredients</label>
              <button type="button" onClick={addBomIngredientRow}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium">+ Add Ingredient</button>
            </div>
            <div className="space-y-2">
              {bomIngredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={ing.raw_material_id}
                    onChange={(e) => {
                      const updated = [...bomIngredients];
                      updated[idx].raw_material_id = e.target.value;
                      setBomIngredients(updated);
                    }}
                    className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none">
                    <option value="">Select material</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                  </select>
                  <input type="number" step="0.0001" value={ing.grams_per_unit} placeholder="g/unit"
                    onChange={(e) => {
                      const updated = [...bomIngredients];
                      updated[idx].grams_per_unit = e.target.value;
                      setBomIngredients(updated);
                    }}
                    className="w-28 border border-slate-300 rounded px-2 py-1.5 text-xs text-right focus:ring-1 focus:ring-teal-500 outline-none" />
                  {bomIngredients.length > 1 && (
                    <button type="button" onClick={() => removeBomIngredientRow(idx)}
                      className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setNewBomModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create BOM'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View BOM Modal ── */}
      <Modal open={viewBomModalOpen} onClose={() => { setViewBomModalOpen(false); setSelectedBom(null); }}
        title={selectedBom ? `BOM: ${selectedBom.macropack_code} — ${selectedBom.macropack_name}` : 'BOM Details'}>
        {selectedBom && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500">Version</span>
                <p className="font-medium text-slate-800">v{selectedBom.version}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Status</span>
                <p>{selectedBom.is_active
                  ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                  : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                }</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Ingredients</span>
                <p className="font-medium text-slate-800">{selectedBomIngredients.length}</p>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Ingredient</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Grams / Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBomIngredients.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">No ingredients</td></tr>
                  ) : selectedBomIngredients.map(ing => (
                    <tr key={ing.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-700">{ing.raw_materials?.code}</td>
                      <td className="px-3 py-2 text-slate-600">{ing.raw_materials?.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">{Number(ing.grams_per_unit).toFixed(4)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td colSpan={2} className="px-3 py-2 text-right text-slate-700">Total grams / unit</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                      {selectedBomIngredients.reduce((s, i) => s + Number(i.grams_per_unit), 0).toFixed(4)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Override Modal */}
      <StockOverrideModal
        open={showStockOverride}
        onClose={() => {
          setShowStockOverride(false);
          setStockErrors([]);
          setPendingCompleteCallback(null);
        }}
        errors={stockErrors}
        transactionType="macropack_manufacture"
        onConfirm={async () => {
          if (pendingCompleteCallback) {
            await pendingCompleteCallback();
          }
        }}
      />
    </div>
  );
}
