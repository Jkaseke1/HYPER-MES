import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Play, Check, Package, CheckCircle2, Clock, Layers, AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { ProductionOrder, Formulation, Machine as ProductionLine, Profile, ProductionPlan, ProductionLog } from '../types/database';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import StatCard from '../components/ui/StatCard';

interface OrderMaterial {
  id: string; 
  raw_material_id: string; 
  planned_qty: number; 
  actual_qty: number;
  wastage_qty: number; 
  unit: string; 
  unit_cost: number; 
  total_cost: number;
  issued: boolean; 
  issued_at?: string;
  issued_by?: string;
  raw_materials?: { name: string; code: string; cost_per_unit: number; current_stock: number; };
}

type TabFilter = 'all' | 'pending' | 'materials_issued' | 'in_progress' | 'completed';
const tabs: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' }, 
  { key: 'pending', label: 'Pending' },
  { key: 'materials_issued', label: 'Materials Issued' },
  { key: 'in_progress', label: 'In Progress' }, 
  { key: 'completed', label: 'Completed' },
];

const calculateMaterialCost = (items: OrderMaterial[]) =>
  items.reduce((sum, mat) => sum + ((mat.actual_qty || mat.planned_qty) * (mat.unit_cost || 0)), 0);

// Calculate raw material cost from issued ingredients only
const calculateIssuedMaterialCost = (items: OrderMaterial[]) =>
  items.filter(m => m.issued).reduce((sum, mat) => sum + ((mat.actual_qty || mat.planned_qty) * (mat.unit_cost || 0)), 0);

// Calculate planned cost based on BOM quantities
const calculatePlannedMaterialCost = (items: OrderMaterial[]) =>
  items.reduce((sum, mat) => sum + (mat.planned_qty * (mat.unit_cost || 0)), 0);

// Labour rates per production line (per tonne)
const LABOUR_RATES: Record<string, number> = {
  'Main Plant': 2.78,
  'Dog Plant': 18.02,
  'Samora Mix': 5.00,
  'Red Plant': 25.50,
};

const emptyForm = {
  batch_number: '', 
  plan_id: '', 
  formulation_id: '', 
  machine_id: '', 
  planned_qty: 0, 
  unit: 'kg',
  priority: 'normal' as const, 
  planned_start: '', 
  planned_end: '', 
  operator_id: '', 
  notes: '',
};

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
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
  const [detailTab, setDetailTab] = useState<'materials' | 'costing' | 'output' | 'variance' | 'logs'>('materials');
  const [bomVariances, setBomVariances] = useState<any[]>([]);
  const [costing, setCosting] = useState({ raw_material_cost: 0, labour_cost: 0, production_line_cost: 0, overhead_cost: 0 });
  const [output, setOutput] = useState({ actual_qty: 0, rejected_qty: 0, wastage_qty: 0 });
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // Delete production order with status protection
  const deleteOrder = async (order: ProductionOrder) => {
    if (order.status !== 'pending') {
      setWorkflowError('Cannot delete — this order has been processed. Only pending orders can be deleted.');
      return;
    }

    if (!window.confirm(`Delete production order ${order.batch_number}? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('production_orders').delete().eq('id', order.id);
      if (error) throw error;
      setShowDetail(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error deleting order:', error);
      setWorkflowError(`Failed to delete order: ${error.message}`);
      setSaving(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('production_orders').select('*, formulations(name, code, batch_size), machines(name, code), profiles!operator_id(full_name, email)').order('created_at', { ascending: false });
    if (tab !== 'all') q = q.eq('status', tab);
    if (search) q = q.ilike('batch_number', `%${search}%`);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } else {
      setOrders((data as ProductionOrder[]) || []);
    }
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
      setProductionLines((m.data as ProductionLine[]) || []);
      setProfiles((p.data as Profile[]) || []);
      setPlans((pl.data as ProductionPlan[]) || []);
    });
  }, []);

  const genBatch = () => `BATCH-2026-${String(Math.floor(Math.random() * 900) + 100)}`;
  const openCreate = () => { 
    setForm({ ...emptyForm, batch_number: genBatch() }); 
    setMaterials([]); 
    setWorkflowError(null);
    setShowCreate(true); 
  };
  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  // Load BOM ingredients when formulation changes (Issue 1)
  const onFormulationChange = async (fid: string) => {
    setForm((f) => ({ ...f, formulation_id: fid }));
    if (!fid) { 
      setMaterials([]); 
      return; 
    }
    const sel = formulations.find((f) => f.id === fid);
    if (!sel) return;
    
    // Check if BOM exists for this formulation
    const { data: bomData, error: bomError } = await supabase
      .from('formulation_ingredients')
      .select('*, raw_materials(name, code, cost_per_unit, current_stock)')
      .eq('formulation_id', fid)
      .eq('is_active', true);
    
    if (bomError || !bomData || bomData.length === 0) {
      setWorkflowError(`No BOM ingredients found for ${sel.name}. Please set up the BOM first.`);
      setMaterials([]);
      return;
    }
    
    setWorkflowError(null);
    const scale = form.planned_qty > 0 ? form.planned_qty / sel.batch_size : 1;
    setMaterials(bomData.map((ing: any) => ({
      id: ing.id, 
      raw_material_id: ing.raw_material_id,
      planned_qty: Math.round(ing.quantity * scale * 100) / 100, 
      actual_qty: 0, 
      wastage_qty: 0,
      unit: ing.unit, 
      unit_cost: ing.raw_materials?.cost_per_unit || 0,
      total_cost: Math.round(ing.quantity * scale * (ing.raw_materials?.cost_per_unit || 0) * 100) / 100,
      issued: false, 
      raw_materials: ing.raw_materials,
    })));
  };

  const createOrder = async () => {
    // Validate production line is required (Issue 3)
    if (!form.machine_id || form.machine_id === '') {
      setWorkflowError('Production Line selection is required. Every batch must be assigned to a specific production line.');
      return;
    }

    setSaving(true);
    try {
      // Debug: Log form data before submission
      console.log('Creating order with form data:', {
        batch_number: form.batch_number,
        formulation_id: form.formulation_id,
        machine_id: form.machine_id,
        planned_qty: form.planned_qty,
        status: 'pending'
      });
      
      const { error } = await supabase.from('production_orders').insert({
        batch_number: form.batch_number,
        plan_id: form.plan_id || null,
        formulation_id: form.formulation_id || null,
        machine_id: form.machine_id, // Required field - NOT NULL in database
        planned_qty: form.planned_qty, 
        unit: form.unit,
        priority: form.priority, 
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null, 
        operator_id: form.operator_id || null,
        notes: form.notes, 
        status: 'pending',
      });

      if (error) throw error;

      // BOM ingredients will be auto-loaded by the database trigger
      setSaving(false); 
      setShowCreate(false); 
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      setWorkflowError(`Failed to create production order: ${error.message}`);
      setSaving(false);
    }
  };

  const loadBomVariances = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_bom_variance', { p_production_order_id: orderId });
      
      if (error) throw error;
      setBomVariances(data || []);
    } catch (error) {
      console.error('Error loading BOM variances:', error);
    }
  };

  const openDetail = async (order: ProductionOrder) => {
    setSelected(order);
    setCosting({ raw_material_cost: order.raw_material_cost, labour_cost: order.labour_cost, production_line_cost: order.machine_cost, overhead_cost: order.overhead_cost });
    setOutput({ actual_qty: order.actual_qty, rejected_qty: order.rejected_qty, wastage_qty: order.wastage_qty });
    setDetailTab('materials');
    
    // Load materials with issuance status
    const { data } = await supabase
      .from('production_order_materials')
      .select('*, raw_materials(name, code, cost_per_unit, current_stock)')
      .eq('production_order_id', order.id);
    
    const mats = (data as OrderMaterial[]) || [];
    setDetailMaterials(mats);
    // Calculate raw material cost from issued ingredients only
    setCosting((prev) => ({ ...prev, raw_material_cost: calculateIssuedMaterialCost(mats) }));
    
    // Load BOM variances for completed orders
    if (order.status === 'completed') {
      await loadBomVariances(order.id);
    }
    
    const { data: logData } = await supabase.from('production_logs').select('*').eq('production_order_id', order.id).order('started_at', { ascending: true });
    setLogs((logData as ProductionLog[]) || []);
    setWorkflowError(null);
    setShowDetail(true);
  };

  // Save production output
  const saveProductionOutput = async () => {
    if (!selected) return;
    
    setSaving(true);
    try {
      // Update production order with output quantities
      const { error: orderError } = await supabase
        .from('production_orders')
        .update({
          actual_qty: output.actual_qty,
          rejected_qty: output.rejected_qty,
          wastage_qty: output.wastage_qty
        })
        .eq('id', selected.id);

      if (orderError) throw orderError;

      // Create production output record
      const { error: outputError } = await supabase
        .from('production_outputs')
        .insert({
          production_order_id: selected.id,
          quantity_produced: output.actual_qty,
          rejected_quantity: output.rejected_qty,
          wastage_quantity: output.wastage_qty,
          unit: selected.unit,
          recorded_at: new Date().toISOString(),
          recorded_by: profiles.find(p => p.email === 'admin@hyperfeeds.com')?.id || null
        });

      if (outputError) throw outputError;

      // Refresh the selected order data
      const { data: refreshedOrder } = await supabase
        .from('production_orders')
        .select('*')
        .eq('id', selected.id)
        .single();

      if (refreshedOrder) {
        setSelected(refreshedOrder);
      }

      setWorkflowError(null);
      setSaving(false);
      
      // Show success message
      setWorkflowError('Production output saved successfully!');
      setTimeout(() => setWorkflowError(null), 3000);
      
    } catch (error: any) {
      console.error('Error saving production output:', error);
      setWorkflowError(`Failed to save production output: ${error.message}`);
      setSaving(false);
    }
  };

  // Issue individual ingredient (Issue 4)
  const issueIndividualIngredient = async (material: OrderMaterial) => {
    if (!selected) return;
    
    setSaving(true);
    try {
      // Call the database function to issue individual ingredient
      const { error } = await supabase.rpc('issue_individual_ingredient', {
        p_material_id: material.id,
        p_actual_qty: material.planned_qty,
        p_issued_by: profiles.find(p => p.email === 'admin@hyperfeeds.com')?.id || null
      });

      if (error) throw error;

      // Record as a stock movement so Material Transfer page reflects it
      await supabase.from('stock_movements').insert({
        movement_type: 'transfer_to_production',
        raw_material_id: material.raw_material_id,
        quantity: -Math.abs(material.planned_qty),
        unit: 'kg',
        notes: `Issued to production order ${selected.batch_number}`,
        reference_type: 'production_order',
        reference_id: selected.id,
        batch_number: selected.batch_number,
        movement_date: new Date().toISOString(),
      });

      // Refresh materials
      const { data: refreshedData } = await supabase
        .from('production_order_materials')
        .select('*, raw_materials(name, code, cost_per_unit, current_stock)')
        .eq('production_order_id', selected.id);
      
      const refreshed = (refreshedData as OrderMaterial[]) || [];
      setDetailMaterials(refreshed);
      setCosting((prev) => ({ ...prev, raw_material_cost: calculateIssuedMaterialCost(refreshed) }));
      
      setSaving(false);
    } catch (error: any) {
      console.error('Error issuing ingredient:', error);
      setWorkflowError(`Failed to issue ingredient: ${error.message}`);
      setSaving(false);
    }
  };

  // Check if all ingredients are issued
  const allIngredientsIssued = () => {
    return detailMaterials.length > 0 && detailMaterials.every(m => m.issued);
  };

  // Enforce workflow sequence (Issue 2)
  const updateStatus = async (status: string) => {
    if (!selected) return;
    setWorkflowError(null);
    setSaving(true);
    
    try {
      const updates: any = { status };
      
      // Validate workflow sequence
      if (status === 'materials_issued') {
        if (detailMaterials.length === 0) {
          throw new Error('Cannot issue materials — no ingredients linked to this order. Please set up the BOM for this formulation first.');
        }
        if (!allIngredientsIssued()) {
          throw new Error('Cannot mark materials as issued — not all ingredients have been issued individually. Please issue each ingredient separately from the Components tab.');
        }
      }
      
      if (status === 'in_progress') {
        if (selected.status !== 'materials_issued') {
          throw new Error('Cannot start production — materials must be issued first. Please issue all ingredients before starting production.');
        }
        updates.actual_start = new Date().toISOString();
      }
      
      if (status === 'completed') {
        if (selected.status !== 'in_progress') {
          throw new Error('Cannot complete production order — production must be in progress first. Please start production before completing.');
        }
        if (output.actual_qty <= 0) {
          throw new Error('Cannot complete production order — actual output quantities must be recorded first. Please enter production outputs in the Output tab.');
        }
        
        const total = costing.raw_material_cost + costing.labour_cost + costing.production_line_cost + costing.overhead_cost;
        Object.assign(updates, { 
          ...costing, 
          ...output, 
          total_cost: total,
          cost_per_unit: output.actual_qty > 0 ? Math.round((total / output.actual_qty) * 100) / 100 : 0,
          actual_end: new Date().toISOString() 
        });
      }

      const { error } = await supabase.from('production_orders').update(updates).eq('id', selected.id);
      if (error) throw error;

      // Record stock movement for completed orders
      if (status === 'completed' && output.actual_qty > 0) {
        await supabase.from('stock_movements').insert([{
          movement_type: 'production_output',
          formulation_id: selected.formulation_id,
          quantity: output.actual_qty,
          unit: selected.unit,
          notes: 'Production output recorded',
          reference_type: 'production_order',
          reference_id: selected.id,
          batch_number: selected.batch_number,
          movement_date: new Date().toISOString()
        }]);
      }

      setSaving(false); 
      setShowDetail(false); 
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating status:', error);
      setWorkflowError(error.message);
      setSaving(false);
    }
  };

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    return o.batch_number.toLowerCase().includes(search.toLowerCase());
  });

  const totalOrders = orders.length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const inProgressCount = orders.filter(o => o.status === 'in_progress').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Manage batch production with enforced workflow sequence</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Create Order
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={totalOrders} icon={Package} color="teal" />
        <StatCard title="Pending" value={pendingCount} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgressCount} icon={Play} color="blue" />
        <StatCard title="Completed" value={completedCount} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    tab === t.key
                      ? 'bg-teal-100 text-teal-700'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search batch number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No production orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Batch Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Formulation</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Production Line</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Planned Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actual Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{order.batch_number}</div>
                      {order.profiles?.full_name && (
                        <div className="text-xs text-slate-500 mt-1">
                          Created by <span className="font-medium text-slate-700">{order.profiles.full_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600">{order.formulations?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600">{order.machines?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-slate-800">{order.planned_qty} {order.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-slate-800">{order.actual_qty} {order.unit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => openDetail(order)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Production Order" size="lg">
        <div className="space-y-4">
          {workflowError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{workflowError}</span>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Batch Number</label>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Formulation</label>
              <select
                value={form.formulation_id}
                onChange={(e) => onFormulationChange(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Select formulation</option>
                {formulations.map((f) => (
                  <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Production Line *</label>
              <select
                value={form.machine_id}
                onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
                className={`${inputCls} ${!form.machine_id ? 'border-red-300' : ''}`}
                required
              >
                <option value="">Select production line (required)</option>
                {productionLines.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Planned Quantity</label>
              <input
                type="number"
                step="0.01"
                value={form.planned_qty}
                onChange={(e) => setForm({ ...form, planned_qty: parseFloat(e.target.value) || 0 })}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={inputCls}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="ton">Tonnes (ton)</option>
                <option value="bags">Bags</option>
                <option value="liters">Liters</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Planned Start Date</label>
              <input
                type="date"
                value={form.planned_start}
                onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Planned End Date</label>
              <input
                type="date"
                value={form.planned_end}
                onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Operator</label>
              <select
                value={form.operator_id}
                onChange={(e) => setForm({ ...form, operator_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Select operator</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Production Plan (Optional)</label>
              <select
                value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Select production plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.plan_number}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
              rows={3}
              placeholder="Add any notes or special instructions..."
            />
          </div>

          {materials.length > 0 && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="text-sm font-medium text-teal-800">
                {materials.length} BOM ingredients will be auto-loaded
              </div>
              <div className="text-xs text-teal-600 mt-1">
                Ingredients will be automatically created when the order is saved
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createOrder}
              disabled={saving || !form.machine_id}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Order Detail Modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={`Production Order - ${selected?.batch_number}`} size="xl">
        {selected && (
          <div className="space-y-6">
            {workflowError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{workflowError}</span>
                </div>
              </div>
            )}

            {/* Creator Tag */}
            {selected.profiles?.full_name && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-xs font-medium text-blue-700">
                  Created by <span className="font-semibold">{selected.profiles.full_name}</span>
                </span>
              </div>
            )}

            {/* Order Info */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="text-xs font-medium text-slate-500">Formulation</label>
                <div className="text-sm font-medium text-slate-800">{selected.formulations?.name}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Production Line</label>
                <div className="text-sm font-medium text-slate-800">{selected.machines?.name}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Status</label>
                <div><StatusBadge status={selected.status} /></div>
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                {selected.status === 'pending' && (
                  <button
                    onClick={() => updateStatus('materials_issued')}
                    disabled={saving || detailMaterials.length === 0 || !allIngredientsIssued()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve/Issue Materials
                  </button>
                )}
                
                {selected.status === 'materials_issued' && (
                  <button
                    onClick={() => updateStatus('in_progress')}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Start Production
                  </button>
                )}
                
                {selected.status === 'in_progress' && (
                  <button
                    onClick={() => updateStatus('completed')}
                    disabled={saving || output.actual_qty <= 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Production
                  </button>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ArrowRight className="w-4 h-4" />
                  <span>Workflow: Pending → Materials Issued → In Progress → Completed</span>
                </div>
              </div>

              {selected.status === 'pending' && (
                <button
                  onClick={() => deleteOrder(selected)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Delete Order
                </button>
              )}
            </div>

            {/* Detail Tabs */}
            <div className="border-b border-slate-200">
              <div className="flex gap-4">
                {(['materials', 'costing', 'output', 'variance', 'logs'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDetailTab(t)}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === t
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-600 hover:text-slate-800'
                    }`}
                    disabled={t === 'variance' && selected?.status !== 'completed'}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {t === 'variance' && selected?.status !== 'completed' && (
                      <span className="ml-1 text-xs text-slate-400">(Completed)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Materials Tab */}
            {detailTab === 'materials' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Components (BOM Ingredients)</h3>
                  <div className="text-sm text-slate-600">
                    {detailMaterials.filter(m => m.issued).length} of {detailMaterials.length} issued
                  </div>
                </div>
                
                {detailMaterials.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No ingredients loaded - BOM may not be set up</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Material</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Planned Qty</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Actual Qty</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Unit Cost</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Total Cost</th>
                          <th className="text-center px-3 py-2 font-medium text-slate-600">Status</th>
                          <th className="text-center px-3 py-2 font-medium text-slate-600">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailMaterials.map((material) => (
                          <tr key={material.id}>
                            <td className="px-3 py-2">
                              <div className="font-medium">{material.raw_materials?.name}</div>
                              <div className="text-xs text-slate-500">{material.raw_materials?.code}</div>
                            </td>
                            <td className="px-3 py-2 text-right">{material.planned_qty} {material.unit}</td>
                            <td className="px-3 py-2 text-right">
                              {material.issued ? (material.actual_qty || material.planned_qty) : '-'} {material.unit}
                            </td>
                            <td className="px-3 py-2 text-right">${material.unit_cost}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${material.issued ? (material.actual_qty || material.planned_qty) * material.unit_cost : 0}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {material.issued ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Issued
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {!material.issued && selected.status === 'pending' && (
                                <div className="flex flex-col gap-1">
                                  {material.raw_materials?.current_stock && material.raw_materials.current_stock < material.planned_qty && (
                                    <div className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      Insufficient stock — only {material.raw_materials.current_stock.toLocaleString()}{material.unit} available
                                    </div>
                                  )}
                                  <button
                                    onClick={() => issueIndividualIngredient(material)}
                                    disabled={saving}
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                                      material.raw_materials?.current_stock && material.raw_materials.current_stock < material.planned_qty
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                                    }`}
                                  >
                                    <Check className="w-3 h-3" />
                                    Issue
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Costing Tab */}
            {detailTab === 'costing' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-800">Cost Breakdown</h3>
                
                {(() => {
                  // Calculate all costs
                  const rawMaterialCost = costing.raw_material_cost;
                  const lineRate = selected.machines?.name ? LABOUR_RATES[selected.machines.name] || 0 : 0;
                  const actualTonnes = output.actual_qty > 0 ? output.actual_qty / 1000 : 0;
                  const productionLineCost = lineRate * actualTonnes;
                  const totalCost = rawMaterialCost + productionLineCost + costing.labour_cost + costing.overhead_cost;
                  const costPerKg = output.actual_qty > 0 ? totalCost / output.actual_qty : 0;
                  
                  // Planned cost calculation
                  const plannedLineRate = selected.machines?.name ? LABOUR_RATES[selected.machines.name] || 0 : 0;
                  const plannedTonnes = selected.planned_qty > 0 ? selected.planned_qty / 1000 : 0;
                  const plannedLineCost = plannedLineRate * plannedTonnes;
                  const plannedBomCost = calculatePlannedMaterialCost(detailMaterials);
                  const plannedTotalCost = plannedBomCost + plannedLineCost + costing.labour_cost + costing.overhead_cost;
                  const plannedCostPerKg = selected.planned_qty > 0 ? plannedTotalCost / selected.planned_qty : 0;
                  
                  const varianceCostPerKg = costPerKg - plannedCostPerKg;
                  
                  return (
                    <>
                      {/* Cost Summary Cards */}
                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-slate-500 mb-1">Raw Material</div>
                          <div className="text-xl font-bold text-slate-800">${rawMaterialCost.toFixed(2)}</div>
                          <div className="text-xs text-slate-400 mt-1">Issued ingredients</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-blue-600 mb-1">Production Line</div>
                          <div className="text-xl font-bold text-blue-700">${productionLineCost.toFixed(2)}</div>
                          <div className="text-xs text-blue-600 mt-1">{lineRate}/tonne</div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-purple-600 mb-1">Labour</div>
                          <div className="text-xl font-bold text-purple-700">${costing.labour_cost.toFixed(2)}</div>
                          <div className="text-xs text-purple-600 mt-1">Editable</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-orange-600 mb-1">Overhead</div>
                          <div className="text-xl font-bold text-orange-700">${costing.overhead_cost.toFixed(2)}</div>
                          <div className="text-xs text-orange-600 mt-1">Editable</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="text-xs font-medium text-emerald-600 mb-1">Total Cost</div>
                          <div className="text-xl font-bold text-emerald-700">${totalCost.toFixed(2)}</div>
                          <div className="text-xs text-emerald-600 mt-1">All costs</div>
                        </div>
                      </div>

                      {/* Cost Per Unit Cards */}
                      <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <div className="text-xs font-medium text-amber-600 mb-1">Actual Cost per kg</div>
                          <div className="text-2xl font-bold text-amber-700">${costPerKg.toFixed(4)}</div>
                          <div className="text-xs text-amber-600 mt-1">Based on {output.actual_qty} kg output</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="text-xs font-medium text-slate-600 mb-1">Planned Cost per kg</div>
                          <div className="text-2xl font-bold text-slate-700">${plannedCostPerKg.toFixed(4)}</div>
                          <div className="text-xs text-slate-600 mt-1">Based on {selected.planned_qty} kg planned</div>
                        </div>
                        <div className={`rounded-lg p-4 border ${varianceCostPerKg > 0 ? 'bg-red-50 border-red-200' : varianceCostPerKg < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className={`text-xs font-medium mb-1 ${varianceCostPerKg > 0 ? 'text-red-600' : varianceCostPerKg < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            Variance per kg
                          </div>
                          <div className={`text-2xl font-bold ${varianceCostPerKg > 0 ? 'text-red-700' : varianceCostPerKg < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                            ${(varianceCostPerKg > 0 ? '+' : '') + varianceCostPerKg.toFixed(4)}
                          </div>
                          <div className={`text-xs mt-1 ${varianceCostPerKg > 0 ? 'text-red-600' : varianceCostPerKg < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {varianceCostPerKg > 0 ? 'Over budget' : varianceCostPerKg < 0 ? 'Under budget' : 'On budget'}
                          </div>
                        </div>
                      </div>

                      {/* Editable Fields */}
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                        <div>
                          <label className={labelCls}>Labour Cost (Editable)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={costing.labour_cost}
                            onChange={(e) => setCosting({ ...costing, labour_cost: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                            disabled={selected.status !== 'in_progress'}
                          />
                          <div className="text-xs text-slate-500 mt-1">Manual override for labour costs</div>
                        </div>
                        <div>
                          <label className={labelCls}>Overhead Cost (Editable)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={costing.overhead_cost}
                            onChange={(e) => setCosting({ ...costing, overhead_cost: parseFloat(e.target.value) || 0 })}
                            className={inputCls}
                            disabled={selected.status !== 'in_progress'}
                          />
                          <div className="text-xs text-slate-500 mt-1">Utilities, maintenance, etc.</div>
                        </div>
                      </div>

                      {/* Read-only Fields */}
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                        <div>
                          <label className={labelCls}>Raw Material Cost (Auto-calculated)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={rawMaterialCost}
                            className={`${inputCls} bg-slate-100 cursor-not-allowed`}
                            disabled
                          />
                          <div className="text-xs text-slate-500 mt-1">Sum of {detailMaterials.filter(m => m.issued).length} issued ingredients</div>
                        </div>
                        <div>
                          <label className={labelCls}>Production Line Cost (Auto-calculated)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={productionLineCost}
                            className={`${inputCls} bg-slate-100 cursor-not-allowed`}
                            disabled
                          />
                          <div className="text-xs text-slate-500 mt-1">{output.actual_qty} kg × ${lineRate}/tonne</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Output Tab */}
            {detailTab === 'output' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Production Output</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Actual Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={output.actual_qty}
                      onChange={(e) => setOutput({ ...output, actual_qty: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                      disabled={selected.status !== 'in_progress'}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Rejected Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={output.rejected_qty}
                      onChange={(e) => setOutput({ ...output, rejected_qty: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                      disabled={selected.status !== 'in_progress'}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Wastage Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={output.wastage_qty}
                      onChange={(e) => setOutput({ ...output, wastage_qty: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                      disabled={selected.status !== 'in_progress'}
                    />
                  </div>
                </div>

                {/* Save Output Button */}
                {selected.status === 'in_progress' && (
                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <button
                      onClick={saveProductionOutput}
                      disabled={saving || output.actual_qty <= 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Save Output
                    </button>
                  </div>
                )}

                {/* Output Status */}
                {selected.actual_qty > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-800">
                      Production output saved: {selected.actual_qty} {selected.unit}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      You can now complete the production order
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Variance Tab */}
            {detailTab === 'variance' && selected.status === 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">BOM Variance Analysis</h3>
                  <div className="text-sm text-slate-600">
                    Comparing BOM required vs actual materials used
                  </div>
                </div>
                
                {bomVariances.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No variance data available</p>
                  </div>
                ) : (
                  <>
                    {/* Variance Summary */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-emerald-600 mb-1">Within Tolerance</div>
                        <div className="text-lg font-bold text-emerald-700">
                          {bomVariances.filter(v => v.status === 'Within Tolerance').length}
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-amber-600 mb-1">Minor Variance</div>
                        <div className="text-lg font-bold text-amber-700">
                          {bomVariances.filter(v => v.status === 'Minor Variance').length}
                        </div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-red-600 mb-1">Major Variance</div>
                        <div className="text-lg font-bold text-red-700">
                          {bomVariances.filter(v => v.status === 'Major Variance').length}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-slate-600 mb-1">Total Variance</div>
                        <div className="text-lg font-bold text-slate-700">
                          ${bomVariances.reduce((sum, v) => sum + (v.cost_variance || 0), 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Variance Table */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Material</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">BOM Required</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Actual Used</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Qty Variance</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">% Variance</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Cost Variance</th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bomVariances.map((variance, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2">
                                <div className="font-medium">{variance.raw_material_name}</div>
                                <div className="text-xs text-slate-500">{variance.raw_material_code}</div>
                              </td>
                              <td className="px-3 py-2 text-right">{variance.planned_qty} {variance.unit}</td>
                              <td className="px-3 py-2 text-right">{variance.actual_qty} {variance.unit}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`font-medium ${
                                  variance.variance_qty > 0 ? 'text-red-600' : 
                                  variance.variance_qty < 0 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {variance.variance_qty > 0 ? '+' : ''}{variance.variance_qty} {variance.unit}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={`font-medium ${
                                  Math.abs(variance.variance_pct) <= 5 ? 'text-emerald-600' :
                                  Math.abs(variance.variance_pct) <= 10 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {variance.variance_pct > 0 ? '+' : ''}{variance.variance_pct}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={`font-medium ${
                                  variance.cost_variance > 0 ? 'text-red-600' : 
                                  variance.cost_variance < 0 ? 'text-emerald-600' : 'text-slate-600'
                                }`}>
                                  ${variance.cost_variance > 0 ? '+' : ''}{variance.cost_variance.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                  variance.status === 'Within Tolerance' ? 'bg-emerald-100 text-emerald-700' :
                                  variance.status === 'Minor Variance' ? 'bg-amber-100 text-amber-700' :
                                  variance.status === 'Major Variance' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {variance.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Variance Insights */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <div className="font-medium mb-1">Variance Analysis Insights</div>
                          <ul className="space-y-1 text-xs">
                            <li>• Materials with &le;5% variance are within acceptable tolerance</li>
                            <li>• Materials with 5-10% variance require investigation</li>
                            <li>• Materials with &gt;10% variance indicate significant process issues</li>
                            <li>• Total cost variance impacts profitability and pricing decisions</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logs Tab */}
            {detailTab === 'logs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Production Logs</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Description</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Start Time</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                              log.log_type === 'start' ? 'bg-blue-100 text-blue-700' :
                              log.log_type === 'stop' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {log.log_type}
                            </span>
                          </td>
                          <td className="px-3 py-2">{log.description}</td>
                          <td className="px-3 py-2">{log.started_at ? format(new Date(log.started_at), 'dd MMM yyyy HH:mm') : '-'}</td>
                          <td className="px-3 py-2">{log.duration_minutes ? `${log.duration_minutes} min` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
