import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Play, Check, Package, AlertTriangle, CheckCircle2, Circle, Clock, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { ProductionOrder, Formulation, Machine, Profile, ProductionPlan, ProductionLog } from '../types/database';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ApprovalButtons from '../components/approval/ApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import StatCard from '../components/ui/StatCard';

interface OrderMaterial {
  id: string; raw_material_id: string; planned_qty: number; actual_qty: number;
  wastage_qty: number; unit: string; unit_cost: number; total_cost: number;
  issued: boolean; raw_materials?: { name: string; code: string; cost_per_unit: number };
}

type TabFilter = 'all' | 'pending' | 'materials_issued' | 'in_progress' | 'completed';
const tabs: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' },
  { key: 'materials_issued', label: 'Materials Issued' },
  { key: 'in_progress', label: 'In Progress' }, { key: 'completed', label: 'Completed' },
];

type StockMovementInsert = {
  movement_type: string;
  raw_material_id?: string | null;
  formulation_id?: string | null;
  warehouse_id?: string | null;
  quantity: number;
  unit: string;
  notes?: string;
  movement_date?: string;
};

const calculateMaterialCost = (items: OrderMaterial[]) =>
  items.reduce((sum, mat) => sum + ((mat.actual_qty || mat.planned_qty) * (mat.unit_cost || 0)), 0);
const emptyForm = {
  batch_number: '', plan_id: '', formulation_id: '', machine_id: '', planned_qty: 0, unit: 'kg',
  priority: 'normal' as const, planned_start: '', planned_end: '', operator_id: '', notes: '',
};

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [materials, setMaterials] = useState<OrderMaterial[]>([]);
  const [detailMaterials, setDetailMaterials] = useState<OrderMaterial[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [detailTab, setDetailTab] = useState<'materials' | 'costing' | 'output' | 'logs'>('materials');
  const [costing, setCosting] = useState({ raw_material_cost: 0, labour_cost: 0, machine_cost: 0, overhead_cost: 0 });
  const [output, setOutput] = useState({ actual_qty: 0, rejected_qty: 0, wastage_qty: 0 });
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [logForm, setLogForm] = useState({ log_type: 'start', description: '', started_at: '', ended_at: '', duration_minutes: '' });
  const [logSaving, setLogSaving] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const resetLogForm = () => {
    setLogForm({ log_type: 'start', description: '', started_at: '', ended_at: '', duration_minutes: '' });
    setEditingLogId(null);
  };

  async function recordStockMovements(order: ProductionOrder | null, rows: StockMovementInsert[]) {
    if (!order || !rows.length) return;
    try {
      await supabase.from('stock_movements').insert(rows.map(row => ({
        reference_type: 'production_order',
        reference_id: order.id,
        batch_number: order.batch_number,
        movement_date: row.movement_date || new Date().toISOString(),
        ...row,
      })));
    } catch (error) {
      console.error('Failed to record stock movement', error);
    }
  }

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('production_orders').select('*, formulations(name, code, batch_size), machines(name, code)').order('created_at', { ascending: false });
    if (tab !== 'all') q = q.eq('status', tab);
    if (search) q = q.ilike('batch_number', `%${search}%`);
    const { data } = await q;
    setOrders((data as ProductionOrder[]) || []);
    setLoading(false);
  }, [tab, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    Promise.all([
      supabase.from('formulations').select('*').eq('status', 'active'),
      supabase.from('machines').select('*').eq('is_active', true),
      supabase.from('profiles').select('*'),
      supabase.from('production_plans').select('*').order('created_at', { ascending: false }),
    ]).then(([f, m, p, pl]) => {
      setFormulations((f.data as Formulation[]) || []);
      setMachines((m.data as Machine[]) || []);
      setProfiles((p.data as Profile[]) || []);
      setPlans((pl.data as ProductionPlan[]) || []);
    });
  }, []);

  const genBatch = () => `BATCH-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
  const openCreate = () => { setForm({ ...emptyForm, batch_number: genBatch() }); setMaterials([]); setShowCreate(true); };
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  const onFormulationChange = async (fid: string) => {
    setForm((f) => ({ ...f, formulation_id: fid }));
    if (!fid) { setMaterials([]); return; }
    const sel = formulations.find((f) => f.id === fid);
    if (!sel) return;
    const { data } = await supabase.from('formulation_ingredients').select('*, raw_materials(name, code, cost_per_unit)').eq('formulation_id', fid);
    if (!data) return;
    const scale = form.planned_qty > 0 ? form.planned_qty / sel.batch_size : 1;
    setMaterials(data.map((ing: any) => ({
      id: ing.id, raw_material_id: ing.raw_material_id,
      planned_qty: Math.round(ing.quantity * scale * 100) / 100, actual_qty: 0, wastage_qty: 0,
      unit: ing.unit, unit_cost: ing.raw_materials?.cost_per_unit || 0,
      total_cost: Math.round(ing.quantity * scale * (ing.raw_materials?.cost_per_unit || 0) * 100) / 100,
      issued: false, raw_materials: ing.raw_materials,
    })));
  };

  const createOrder = async () => {
    setSaving(true);
    const { data } = await supabase.from('production_orders').insert({
      batch_number: form.batch_number,
      plan_id: form.plan_id || null,
      formulation_id: form.formulation_id || null,
      machine_id: form.machine_id || null, planned_qty: form.planned_qty, unit: form.unit,
      priority: form.priority, planned_start: form.planned_start || null,
      planned_end: form.planned_end || null, operator_id: form.operator_id || null,
      notes: form.notes, status: 'pending',
    }).select().single();
    if (data && materials.length > 0) {
      await supabase.from('production_order_materials').insert(materials.map((m) => ({
        production_order_id: data.id, raw_material_id: m.raw_material_id,
        planned_qty: m.planned_qty, actual_qty: 0, wastage_qty: 0,
        unit: m.unit, unit_cost: m.unit_cost, total_cost: m.total_cost, issued: false,
      })));
    }
    setSaving(false); setShowCreate(false); fetchOrders();
  };

  const openDetail = async (order: ProductionOrder) => {
    setSelected(order);
    setCosting({ raw_material_cost: order.raw_material_cost, labour_cost: order.labour_cost, machine_cost: order.machine_cost, overhead_cost: order.overhead_cost });
    setOutput({ actual_qty: order.actual_qty, rejected_qty: order.rejected_qty, wastage_qty: order.wastage_qty });
    setDetailTab('materials');
    const { data } = await supabase.from('production_order_materials').select('*, raw_materials(name, code, cost_per_unit)').eq('production_order_id', order.id);
    const mats = (data as OrderMaterial[]) || [];
    setDetailMaterials(mats);
    setCosting((prev) => ({ ...prev, raw_material_cost: calculateMaterialCost(mats) }));
    const { data: logData } = await supabase.from('production_logs').select('*').eq('production_order_id', order.id).order('started_at', { ascending: true });
    setLogs((logData as ProductionLog[]) || []);
    resetLogForm();
    setShowDetail(true);
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true);
    const updates: any = { status };
    if (status === 'in_progress') updates.actual_start = new Date().toISOString();
    if (status === 'completed') {
      const total = costing.raw_material_cost + costing.labour_cost + costing.machine_cost + costing.overhead_cost;
      Object.assign(updates, { ...costing, ...output, total_cost: total,
        cost_per_unit: output.actual_qty > 0 ? Math.round((total / output.actual_qty) * 100) / 100 : 0,
        actual_end: new Date().toISOString() });
    }
    await supabase.from('production_orders').update(updates).eq('id', selected.id);
    if (status === 'completed' && (output.actual_qty > 0 || selected.planned_qty > 0)) {
      await recordStockMovements(selected, [{
        movement_type: 'production_output',
        formulation_id: selected.formulation_id,
        quantity: output.actual_qty > 0 ? output.actual_qty : selected.planned_qty,
        unit: selected.unit,
        notes: 'Production output recorded',
      }]);
    }
    setSaving(false); setShowDetail(false); fetchOrders();
  };

  const issueMaterial = async (mat: OrderMaterial) => {
    if (!selected) return;
    await supabase.from('production_order_materials').update({ issued: true, actual_qty: mat.planned_qty, issued_at: new Date().toISOString() }).eq('id', mat.id);
    setDetailMaterials((prev) => {
      const next = prev.map((m) => m.id === mat.id ? { ...m, issued: true, actual_qty: mat.planned_qty } : m);
      setCosting((prevCost) => ({ ...prevCost, raw_material_cost: calculateMaterialCost(next) }));
      return next;
    });
    await recordStockMovements(selected, [{
      movement_type: 'production_input',
      raw_material_id: mat.raw_material_id,
      quantity: mat.planned_qty,
      unit: mat.unit,
      notes: `Issued ${mat.planned_qty} ${mat.unit}`,
    }]);
  };

  const issueAllMaterials = async () => {
    if (!selected) return;
    const pending = detailMaterials.filter((m) => !m.issued);
    if (pending.length === 0) {
      setSelected((s) => s ? { ...s, status: 'materials_issued' } : s);
      await supabase.from('production_orders').update({ status: 'materials_issued' }).eq('id', selected.id);
      fetchOrders();
      return;
    }
    setSaving(true);
    await supabase.from('production_order_materials').update({ issued: true, issued_at: new Date().toISOString() }).eq('production_order_id', selected.id).eq('issued', false);
    setDetailMaterials((prev) => {
      const next = prev.map((m) => ({ ...m, issued: true, actual_qty: m.actual_qty || m.planned_qty }));
      setCosting((prevCost) => ({ ...prevCost, raw_material_cost: calculateMaterialCost(next) }));
      return next;
    });
    await supabase.from('production_orders').update({ status: 'materials_issued' }).eq('id', selected.id);
    setSelected((s) => s ? { ...s, status: 'materials_issued' } : s);
    await recordStockMovements(selected, pending.map(m => ({
      movement_type: 'production_input',
      raw_material_id: m.raw_material_id,
      quantity: m.planned_qty,
      unit: m.unit,
      notes: 'Issued to production order',
    })));
    setSaving(false); fetchOrders();
  };

  const addLog = async () => {
    if (!selected) return;
    if (!logForm.started_at) {
      alert('Please provide a start time for the log.');
      return;
    }
    setLogSaving(true);
    try {
      const payload = {
        production_order_id: selected.id,
        log_type: logForm.log_type as ProductionLog['log_type'],
        description: logForm.description,
        started_at: new Date(logForm.started_at).toISOString(),
        ended_at: logForm.ended_at ? new Date(logForm.ended_at).toISOString() : null,
        duration_minutes: Number(logForm.duration_minutes) || 0,
        machine_id: selected.machine_id,
        operator_id: selected.operator_id,
      };
      if (editingLogId) {
        const { error } = await supabase.from('production_logs').update(payload).eq('id', editingLogId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('production_logs').insert(payload);
        if (error) throw error;
      }
      const { data } = await supabase.from('production_logs').select('*').eq('production_order_id', selected.id).order('started_at', { ascending: true });
      setLogs((data as ProductionLog[]) || []);
      resetLogForm();
    } catch (error) {
      console.error('Failed to add production log', error);
      alert('Could not save production log.');
    } finally {
      setLogSaving(false);
    }
  };

  const milestoneSteps = selected ? [
    { label: 'Order Created', done: true },
    { label: 'Materials Issued', done: ['materials_issued','in_progress','completed','cancelled'].includes(selected.status) },
    { label: 'In Production', done: ['in_progress','completed'].includes(selected.status) },
    { label: 'Completed', done: selected.status === 'completed' },
  ] : [];
  const yieldPct = selected && selected.planned_qty > 0 ? Math.round((selected.actual_qty / selected.planned_qty) * 100) : 0;

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const inProgressCount = orders.filter(o => o.status === 'in_progress').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const totalPlannedQty = orders.reduce((sum, o) => sum + (o.planned_qty || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage batch production and track manufacturing</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={orders.length} icon={Layers} color="teal" />
        <StatCard title="Pending" value={pendingCount} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgressCount} icon={Play} color="cyan" />
        <StatCard title="Completed" value={completedCount} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}>{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch number, formulation..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white" />
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-slate-400">Loading orders...</div>
       : orders.length === 0 ? <div className="text-center py-12 text-slate-400">No production orders found.</div>
       : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Batch Number', 'Formulation', 'Machine', 'Planned Qty', 'Actual Qty', 'Status', 'Priority', 'Planned Start', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openDetail(o)}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-teal-600">{o.batch_number}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">{o.formulations?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{o.machines?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">{o.planned_qty.toLocaleString()} {o.unit}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">{o.actual_qty > 0 ? `${o.actual_qty.toLocaleString()} ${o.unit}` : '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={o.priority} /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{o.planned_start ? format(new Date(o.planned_start), 'dd MMM yyyy') : '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); openDetail(o); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="View details">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Production Order" size="xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Batch Number</label>
            <input
              value={form.batch_number}
              onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
              className={inputCls}
              placeholder="Enter custom batch number"
            />
          </div>
          <div>
            <label className={labelCls}>Production Plan (optional)</label>
            <select
              value={form.plan_id}
              onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Select plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.plan_number} ({plan.status})</option>
              ))}
            </select>
          </div>
          <div><label className={labelCls}>Formulation</label>
            <select value={form.formulation_id} onChange={(e) => onFormulationChange(e.target.value)} className={inputCls}>
              <option value="">Select formulation</option>
              {formulations.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select></div>
          <div><label className={labelCls}>Machine</label>
            <select value={form.machine_id} onChange={(e) => setForm({ ...form, machine_id: e.target.value })} className={inputCls}>
              <option value="">Select machine</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Planned Qty</label><input type="number" value={form.planned_qty || ''} onChange={(e) => setForm({ ...form, planned_qty: +e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Unit</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })} className={inputCls}>
              {['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select></div>
          <div><label className={labelCls}>Operator</label>
            <select value={form.operator_id} onChange={(e) => setForm({ ...form, operator_id: e.target.value })} className={inputCls}>
              <option value="">Select operator</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select></div>
          <div><label className={labelCls}>Planned Start</label><input type="date" value={form.planned_start} onChange={(e) => setForm({ ...form, planned_start: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Planned End</label><input type="date" value={form.planned_end} onChange={(e) => setForm({ ...form, planned_end: e.target.value })} className={inputCls} /></div>
          <div className="col-span-2"><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></div>
        </div>
        {materials.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Bill of Materials (scaled)</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50"><th className="px-3 py-2 text-left text-slate-600">Material</th><th className="px-3 py-2 text-left text-slate-600">Qty</th><th className="px-3 py-2 text-left text-slate-600">Unit</th><th className="px-3 py-2 text-right text-slate-600">Cost</th></tr></thead>
                <tbody>{materials.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{m.raw_materials?.name}</td><td className="px-3 py-2 text-slate-600">{m.planned_qty}</td>
                    <td className="px-3 py-2 text-slate-600">{m.unit}</td><td className="px-3 py-2 text-right text-slate-700">{m.total_cost.toFixed(2)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={createOrder} disabled={saving || !form.formulation_id} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">{saving ? 'Creating...' : 'Create Order'}</button>
        </div>
      </Modal>

      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={selected ? `Production Order: ${selected.batch_number}` : 'Order Detail'} size="xl">
        {selected && (<>
          {/* Order Header */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500">Formulation</p>
                <p className="font-semibold text-slate-800">{selected.formulations?.name || '-'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Machine</p>
                <p className="font-semibold text-slate-800">{selected.machines?.name || '-'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Planned Qty</p>
                <p className="font-semibold text-slate-800">{selected.planned_qty.toLocaleString()} {selected.unit}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Actual Qty</p>
                <p className={`font-semibold ${selected.actual_qty > 0 ? 'text-teal-700' : 'text-slate-400'}`}>{selected.actual_qty > 0 ? `${selected.actual_qty.toLocaleString()} ${selected.unit}` : '-'}</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex gap-1.5">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.priority} />
                </div>
              </div>
            </div>
            {/* Milestone Timeline */}
            <div className="flex items-center gap-0 mt-3">
              {milestoneSteps.map((step, idx) => (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    {step.done
                      ? <CheckCircle2 className="w-5 h-5 text-teal-500" />
                      : <Circle className="w-5 h-5 text-slate-300" />}
                    <span className="text-xs text-slate-500 mt-1 whitespace-nowrap">{step.label}</span>
                  </div>
                  {idx < milestoneSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 ${milestoneSteps[idx + 1].done ? 'bg-teal-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
            {/* Yield Bar */}
            {selected.actual_qty > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Yield Rate</span>
                  <span className="font-semibold text-slate-700">{yieldPct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${yieldPct >= 95 ? 'bg-teal-500' : yieldPct >= 80 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(yieldPct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            {selected.status === 'pending' && <button onClick={issueAllMaterials} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"><Package className="w-3.5 h-3.5" /> Issue Materials</button>}
            {selected.status === 'materials_issued' && <button onClick={() => updateStatus('in_progress')} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"><Play className="w-3.5 h-3.5" /> Start Production</button>}
            {selected.status === 'in_progress' && <button onClick={() => updateStatus('completed')} disabled={saving || output.actual_qty <= 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Complete Production</button>}
          </div>
          {/* SAP-style Tabs */}
          <div className="flex border-b border-slate-200 mb-4">
            {(['materials', 'costing', 'output', 'logs'] as const).map((t) => (
              <button key={t} onClick={() => setDetailTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                detailTab === t ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{t === 'materials' ? 'Components' : t === 'logs' ? 'Activity' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          {detailTab === 'materials' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">
                  {['Material', 'Planned', 'Actual', 'Variance', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 text-left text-slate-600 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>{detailMaterials.map((m) => {
                  const actualQty = m.actual_qty > 0 ? m.actual_qty : (m.issued ? m.planned_qty : 0);
                  const v = actualQty - m.planned_qty;
                  return (<tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{m.raw_materials?.name}</td>
                    <td className="px-3 py-2 text-slate-600">{m.planned_qty} {m.unit}</td>
                    <td className="px-3 py-2 text-slate-600">{actualQty > 0 ? `${actualQty} ${m.unit}` : '-'}</td>
                    <td className="px-3 py-2">{actualQty > 0 ? <span className={v > 0 ? 'text-amber-600' : v < 0 ? 'text-red-600' : 'text-emerald-600'}>{v > 0 ? '+' : ''}{v.toFixed(2)} {m.unit}</span> : '-'}</td>
                    <td className="px-3 py-2">{m.issued ? <span className="text-emerald-600 text-xs font-medium">Issued</span> : <span className="text-amber-600 text-xs font-medium">Pending</span>}</td>
                    <td className="px-3 py-2">{!m.issued && selected.status === 'pending' && <button onClick={() => issueMaterial(m)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Issue</button>}</td>
                  </tr>);
                })}</tbody>
              </table>
              {detailMaterials.length === 0 && <div className="text-center py-6 text-slate-400 text-sm">No materials linked to this order.</div>}
            </div>
          )}
          {detailTab === 'costing' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Raw Material Cost</label><input type="number" value={costing.raw_material_cost || ''} onChange={(e) => setCosting({ ...costing, raw_material_cost: +e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Labour Cost</label><input type="number" value={costing.labour_cost || ''} onChange={(e) => setCosting({ ...costing, labour_cost: +e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Machine Cost</label><input type="number" value={costing.machine_cost || ''} onChange={(e) => setCosting({ ...costing, machine_cost: +e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Overhead Cost</label><input type="number" value={costing.overhead_cost || ''} onChange={(e) => setCosting({ ...costing, overhead_cost: +e.target.value })} className={inputCls} /></div>
              <div className="col-span-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex justify-between text-sm"><span className="text-teal-700 font-medium">Total Cost</span><span className="font-bold text-teal-800">{(costing.raw_material_cost + costing.labour_cost + costing.machine_cost + costing.overhead_cost).toFixed(2)}</span></div>
              </div>
              {selected.status !== 'pending' && (
                <div className="col-span-2 flex justify-end">
                  <button onClick={async () => { await supabase.from('production_orders').update(costing).eq('id', selected.id); }} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors">Save Costing</button>
                </div>
              )}
            </div>
          )}
          {detailTab === 'output' && (
            <div className="space-y-4">
              {selected.status !== 'in_progress' && selected.status !== 'completed' && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Production must be in progress to record output.
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Actual Qty ({selected.unit})</label><input type="number" value={output.actual_qty || ''} onChange={(e) => setOutput({ ...output, actual_qty: +e.target.value })} className={inputCls} disabled={selected.status !== 'in_progress'} /></div>
                <div><label className={labelCls}>Rejected Qty</label><input type="number" value={output.rejected_qty || ''} onChange={(e) => setOutput({ ...output, rejected_qty: +e.target.value })} className={inputCls} disabled={selected.status !== 'in_progress'} /></div>
                <div><label className={labelCls}>Wastage Qty</label><input type="number" value={output.wastage_qty || ''} onChange={(e) => setOutput({ ...output, wastage_qty: +e.target.value })} className={inputCls} disabled={selected.status !== 'in_progress'} /></div>
              </div>
              {output.actual_qty > 0 && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm">
                  <div className="flex justify-between"><span className="text-teal-700">Yield Rate</span><span className="font-bold text-teal-800">{((output.actual_qty / selected.planned_qty) * 100).toFixed(1)}%</span></div>
                </div>
              )}
            </div>
          )}
          {selected.status === 'pending' && (
            <div className="border-t border-slate-200 pt-4 mb-4">
              <ApprovalButtons
                entityType="production_order"
                entityId={selected.id}
                currentStatus={selected.status}
                approveStatus="materials_issued"
                rejectStatus="cancelled"
                onApproved={() => {
                  setShowDetail(false);
                  fetchOrders();
                }}
                onRejected={() => {
                  setShowDetail(false);
                  fetchOrders();
                }}
              />
            </div>
          )}
          {selected.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{selected.rejection_reason}</p>
            </div>
          )}
          {detailTab === 'logs' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Type', 'Description', 'Start', 'End', 'Duration (min)'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-600 font-semibold text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No production logs yet.</td></tr>
                    )}
                    {logs.map((log) => {
                      const duration = log.duration_minutes || (log.started_at && log.ended_at ? Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000) : 0);
                      return (
                      <tr key={log.id}>
                        <td className="px-3 py-2 text-slate-700 capitalize">{log.log_type}</td>
                        <td className="px-3 py-2 text-slate-600">{log.description || '-'}</td>
                        <td className="px-3 py-2 text-slate-500">{log.started_at ? new Date(log.started_at).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-slate-500">{log.ended_at ? new Date(log.ended_at).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{duration}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => {
                            setLogForm({
                              log_type: log.log_type,
                              description: log.description,
                              started_at: log.started_at ? log.started_at.substring(0, 16) : '',
                              ended_at: log.ended_at ? log.ended_at.substring(0, 16) : '',
                              duration_minutes: log.duration_minutes?.toString() || '',
                            });
                            setEditingLogId(log.id);
                            setDetailTab('logs');
                          }} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Edit</button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Add Log Entry</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select value={logForm.log_type} onChange={(e) => setLogForm({ ...logForm, log_type: e.target.value })} className={inputCls}>
                      {['start', 'stop', 'pause', 'resume', 'downtime', 'issue', 'info'].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Duration (minutes)</label>
                    <input type="number" value={logForm.duration_minutes} onChange={(e) => setLogForm({ ...logForm, duration_minutes: e.target.value })} className={inputCls} placeholder="e.g. 30" />
                  </div>
                  <div>
                    <label className={labelCls}>Start Time</label>
                    <input type="datetime-local" value={logForm.started_at} onChange={(e) => setLogForm({ ...logForm, started_at: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End Time (optional)</label>
                    <input type="datetime-local" value={logForm.ended_at} onChange={(e) => setLogForm({ ...logForm, ended_at: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Description</label>
                    <textarea value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} rows={2} className={inputCls} placeholder="What happened during this log?" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    {editingLogId && (
                      <button onClick={resetLogForm} type="button" className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                    )}
                    <button onClick={addLog} disabled={logSaving} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                      {logSaving ? 'Saving...' : editingLogId ? 'Update Log' : 'Save Log'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <ApprovalHistory entityType="production_order" entityId={selected.id} />
          </div>
        </>)}
      </Modal>
    </div>
  );
}