import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Truck, MapPin, Package, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { generateDispatchNumber } from '../lib/batchNumberGenerator';
import type { DispatchOrder, DispatchItem, Branch, Warehouse, Formulation } from '../types/database';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ApprovalButtons from '../components/approval/ApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import { validateFGStockAvailability, StockError } from '../lib/stockValidation';
import StockOverrideModal from '../components/stock/StockOverrideModal';

type Tab = 'all' | 'pending' | 'loading' | 'dispatched' | 'in_transit' | 'delivered';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'loading', label: 'Loading' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const EMPTY_ITEM = { formulation_id: '', batch_number: '', quantity: 0, unit: 'kg', unit_price: 0 };

export default function DispatchPage() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<DispatchOrder | null>(null);
  const [viewItems, setViewItems] = useState<DispatchItem[]>([]);
  const initForm = { branch_id: '', warehouse_id: '', dispatch_date: format(new Date(), 'yyyy-MM-dd'), vehicle_number: '', driver_name: '', delivery_notes: '' };
  const [form, setForm] = useState(initForm);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [dispatchNumber, setDispatchNumber] = useState<string>('');
  const [stockErrors, setStockErrors] = useState<StockError[]>([]);
  const [showStockOverride, setShowStockOverride] = useState(false);
  const [pendingDeliverCallback, setPendingDeliverCallback] = useState<(() => Promise<void>) | null>(null);
  const [batchNumbers, setBatchNumbers] = useState<{ [key: string]: string[] }>({});
  const [stockBalances, setStockBalances] = useState<Record<string, number>>({});

  const fetchOrders = useCallback(async () => {
    let q = supabase.from('dispatch_orders').select('*, branches(name, code), warehouses(name)').order('created_at', { ascending: false });
    if (tab !== 'all') q = q.eq('status', tab);
    const { data } = await q;
    if (data) setOrders(data as DispatchOrder[]);
  }, [tab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const load = async () => {
      const [b, w, f] = await Promise.all([
        supabase.from('branches').select('*').eq('is_active', true).order('name'),
        supabase.from('warehouses').select('*').eq('is_active', true).eq('type', 'finished_goods').is('branch_id', null).order('name'),
        supabase.from('formulations').select('*').eq('status', 'active').order('name'),
      ]);
      if (b.data) setBranches(b.data);
      if (w.data) {
        setWarehouses(w.data);
        // Default warehouse to Despatch Warehouse (DSP)
        const dspWarehouse = w.data.find(wh => wh.code === 'DSP');
        if (dspWarehouse) {
          setForm(prev => ({ ...prev, warehouse_id: dspWarehouse.id }));
        }
      }
      if (f.data) setFormulations(f.data);
    };
    load();
  }, []);

  const updateItem = (idx: number, key: string, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [key]: value };
    if (key === 'formulation_id') newItems[idx].batch_number = '';
    setItems(newItems);
    if (key === 'formulation_id' && value) {
      fetchBatchNumbers(value);
      fetchFGStock(value);
    }
  };

  const totalWeight = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.dispatch_number.toLowerCase().includes(s) || o.driver_name.toLowerCase().includes(s) || o.vehicle_number.toLowerCase().includes(s) || (o.branches as any)?.name?.toLowerCase().includes(s);
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      const generatedNumber = await generateDispatchNumber();
      const { data, error } = await supabase.from('dispatch_orders').insert({ ...form, dispatch_number: generatedNumber, status: 'pending', total_weight: totalWeight, total_value: totalValue }).select().single();
      if (!error && data) {
        const rows = items.filter((i) => i.formulation_id).map((i) => ({ dispatch_order_id: data.id, formulation_id: i.formulation_id, batch_number: i.batch_number, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, line_total: i.quantity * i.unit_price }));
        if (rows.length) await supabase.from('dispatch_items').insert(rows);
      }
      if (error) throw error;
    } catch (error: any) {
      console.error('Error creating dispatch order:', error);
      alert(`Failed to create dispatch order: ${error.message}`);
    } finally {
      setSaving(false);
      setShowCreate(false);
      resetForm();
      setDispatchNumber('');
      fetchOrders();
    }
  };

  const resetForm = () => { 
    setForm(initForm); 
    setItems([{ ...EMPTY_ITEM }]); 
    // Re-apply DSP warehouse default
    const dspWarehouse = warehouses.find(wh => wh.code === 'DSP');
    if (dspWarehouse) {
      setForm(prev => ({ ...prev, warehouse_id: dspWarehouse.id }));
    }
  };

  const fetchBatchNumbers = async (formulationId: string) => {
    if (!formulationId) return;
    if (batchNumbers[formulationId]) return;
    const { data } = await supabase
      .from('production_orders')
      .select('batch_number')
      .eq('formulation_id', formulationId)
      .eq('status', 'completed')
      .order('batch_number', { ascending: false });
    if (data) setBatchNumbers(prev => ({ ...prev, [formulationId]: data.map(d => d.batch_number) }));
  };

  const fetchFGStock = async (formulationId: string) => {
    if (!formulationId) return;
    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase.from('stock_movements').select('quantity').eq('formulation_id', formulationId).eq('movement_type', 'production_output'),
      supabase.from('stock_movements').select('quantity').eq('formulation_id', formulationId).eq('movement_type', 'dispatch_out'),
    ]);
    const totalIn = (inbound || []).reduce((s, r) => s + r.quantity, 0);
    const totalOut = (outbound || []).reduce((s, r) => s + r.quantity, 0);
    setStockBalances(prev => ({ ...prev, [formulationId]: totalIn - totalOut }));
  };

  const openView = async (order: DispatchOrder) => {
    setViewOrder(order);
    const { data } = await supabase.from('dispatch_items').select('*, formulations(name, code)').eq('dispatch_order_id', order.id);
    if (data) setViewItems(data as DispatchItem[]);
  };

  const updateStatus = async (id: string, status: string) => {
    // Validate FG stock before marking as delivered
    if (status === 'delivered' && viewOrder?.id === id) {
      const itemsToCheck = viewItems
        .filter(item => item.formulation_id)
        .map(item => ({
          formulation_id: item.formulation_id!,
          quantity: item.quantity,
          name: (item.formulations as any)?.name || 'Unknown'
        }));

      const stockCheck = await validateFGStockAvailability(itemsToCheck);
      if (!stockCheck.isValid) {
        setStockErrors(stockCheck.errors);
        setPendingDeliverCallback(() => async () => {
          await performStatusUpdate(id, status);
        });
        setShowStockOverride(true);
        return;
      }
    }

    await performStatusUpdate(id, status);
  };

  const performStatusUpdate = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    await supabase.from('dispatch_orders').update(updates).eq('id', id);

    // Write dispatch_out movements so FG ledger balance stays accurate
    if (status === 'delivered') {
      const itemsForMovement = viewOrder?.id === id ? viewItems : [];
      const movements = itemsForMovement
        .filter((item) => item.formulation_id)
        .map((item) => ({
          movement_type: 'dispatch_out',
          formulation_id: item.formulation_id,
          quantity: item.quantity,
          unit: item.unit,
          notes: `Dispatched — ${viewOrder?.dispatch_number || id}`,
          reference_type: 'dispatch_order',
          reference_id: id,
          batch_number: item.batch_number || null,
          movement_date: new Date().toISOString(),
        }));
      if (movements.length) await supabase.from('stock_movements').insert(movements);
    }

    if (viewOrder?.id === id) setViewOrder({ ...viewOrder, ...updates });
    fetchOrders();
  };

  const deleteOrder = async (order: DispatchOrder) => {
    // Check deletion protection - only Pending dispatches can be deleted
    if (order.status !== 'pending') {
      alert('Cannot delete — this dispatch has been processed. Only pending dispatches can be deleted.');
      return;
    }

    if (!window.confirm(`Delete dispatch order ${order.dispatch_number}? This action cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('dispatch_orders').delete().eq('id', order.id);
      if (error) throw error;
      setViewOrder(null);
      fetchOrders();
    } catch (error: any) {
      console.error('Error deleting dispatch order:', error);
      alert(`Failed to delete dispatch order: ${error.message}`);
      setSaving(false);
    }
  };

  const STATUS_FLOW: Record<string, { label: string; next: string }> = { pending: { label: 'Start Loading', next: 'loading' }, loading: { label: 'Mark Dispatched', next: 'dispatched' }, dispatched: { label: 'In Transit', next: 'in_transit' }, in_transit: { label: 'Mark Delivered', next: 'delivered' } };
  const nextStatus = (s: string) => STATUS_FLOW[s] || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dispatch Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage finished goods dispatch to branches</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 transition-colors font-medium">
          <Plus className="w-4 h-4" /> New Dispatch
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-slate-100 rounded-lg p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dispatches..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Dispatch #', 'Branch', 'Date', 'Vehicle', 'Driver', 'Weight (kg)', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{o.dispatch_number}</td>
                <td className="px-4 py-3 text-slate-600">{(o.branches as any)?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</td>
                <td className="px-4 py-3 text-slate-600">{o.vehicle_number}</td>
                <td className="px-4 py-3 text-slate-600">{o.driver_name}</td>
                <td className="px-4 py-3 text-slate-600">{o.total_weight.toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openView(o)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye className="w-4 h-4" /></button>
                    {nextStatus(o.status) && (
                      <button onClick={() => updateStatus(o.id, nextStatus(o.status)!.next)} className="px-2 py-1 text-xs font-medium rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
                        {nextStatus(o.status)!.label}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No dispatch orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Dispatch Order" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dispatch #</label>
              <input type="text" value={dispatchNumber || 'Auto-generated'} disabled className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
              <p className="text-xs text-slate-500 mt-1">System generated - cannot be edited</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
              <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dispatch Date</label>
              <input type="date" value={form.dispatch_date} onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Number</label>
              <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
              <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Notes</label>
              <input value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Dispatch Items</h4>
              <button onClick={() => setItems([...items, { ...EMPTY_ITEM }])} className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"><Plus className="w-3.5 h-3.5" /> Add Item</button>
            </div>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  {['Product', 'Batch Number', 'Qty', 'Unit', 'Unit Price', 'Total'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-slate-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-1.5">
                      <select value={item.formulation_id} onChange={(e) => updateItem(idx, 'formulation_id', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        <option value="">Select product</option>
                        {formulations.map((f) => <option key={f.id} value={f.id}>{f.sage_code} — {f.name}</option>)}
                      </select>
                      {item.formulation_id && (
                        <p className={`text-xs mt-0.5 font-semibold ${(stockBalances[item.formulation_id] ?? 0) > 0 ? 'text-teal-600' : 'text-amber-600'}`}>
                          Available: {stockBalances[item.formulation_id] !== undefined ? `${stockBalances[item.formulation_id].toLocaleString()} kg` : '…'}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {batchNumbers[item.formulation_id]?.length ? (
                        <select value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                          <option value="">Select batch</option>
                          {batchNumbers[item.formulation_id].map((bn) => <option key={bn} value={bn}>{bn}</option>)}
                        </select>
                      ) : (
                        <input value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} placeholder="e.g. BATCH-2026-103" className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                      )}
                    </td>
                    <td className="px-3 py-1.5"><input type="number" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', +e.target.value)} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" /></td>
                    <td className="px-3 py-1.5">
                      <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        {['kg', 'bags', 'tons'].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5"><input type="number" value={item.unit_price || ''} onChange={(e) => updateItem(idx, 'unit_price', +e.target.value)} className="w-24 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" /></td>
                    <td className="px-3 py-1.5 text-slate-600">${(item.quantity * item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span className="text-slate-600">Total Weight: <strong className="text-slate-800">{totalWeight.toLocaleString()} kg</strong></span>
              <span className="text-slate-600">Total Value: <strong className="text-slate-800">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.branch_id} className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Dispatch'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title="Dispatch Details" size="xl">
        {viewOrder && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><Truck className="w-5 h-5 text-teal-600" /></div>
                <div>
                  <p className="font-semibold text-slate-800">{viewOrder.dispatch_number}</p>
                  <p className="text-xs text-slate-500">{format(new Date(viewOrder.dispatch_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={viewOrder.status} />
                {nextStatus(viewOrder.status) && (
                  <button onClick={() => updateStatus(viewOrder.id, nextStatus(viewOrder.status)!.next)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                    {nextStatus(viewOrder.status)!.label}
                  </button>
                )}
                {viewOrder.status === 'pending' && (
                  <button onClick={() => deleteOrder(viewOrder)} disabled={saving} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                    <AlertTriangle className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div><p className="text-xs text-slate-500">Branch</p><p className="text-sm font-medium text-slate-700">{(viewOrder.branches as any)?.name || '-'}</p></div>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-slate-400 mt-0.5" />
                <div><p className="text-xs text-slate-500">Vehicle / Driver</p><p className="text-sm font-medium text-slate-700">{viewOrder.vehicle_number} / {viewOrder.driver_name}</p></div>
              </div>
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-slate-400 mt-0.5" />
                <div><p className="text-xs text-slate-500">Weight / Value</p><p className="text-sm font-medium text-slate-700">{viewOrder.total_weight.toLocaleString()} kg / ${viewOrder.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div>
              </div>
            </div>
            {viewOrder.delivery_notes && <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">{viewOrder.delivery_notes}</p>}
            
            {viewOrder.status === 'pending' && (
              <div className="border-t border-slate-200 pt-4">
                <ApprovalButtons
                  entityType="dispatch_order"
                  entityId={viewOrder.id}
                  currentStatus={viewOrder.status}
                  approveStatus="loading"
                  rejectStatus="cancelled"
                  onApproved={() => {
                    setViewOrder(null);
                    fetchOrders();
                  }}
                  onRejected={() => {
                    setViewOrder(null);
                    fetchOrders();
                  }}
                />
              </div>
            )}
            
            {viewOrder.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{viewOrder.rejection_reason}</p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Items</h4>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>{['Product', 'Batch', 'Qty', 'Unit', 'Price', 'Total'].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-slate-600">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-slate-700">{(item.formulations as any)?.name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{item.batch_number}</td>
                      <td className="px-3 py-2 text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-slate-600">{item.unit}</td>
                      <td className="px-3 py-2 text-slate-600">${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">${item.line_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-slate-200 pt-4">
              <ApprovalHistory entityType="dispatch_order" entityId={viewOrder.id} />
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
          setPendingDeliverCallback(null);
        }}
        errors={stockErrors}
        transactionType="dispatch_delivery"
        onConfirm={async () => {
          if (pendingDeliverCallback) {
            await pendingDeliverCallback();
          }
        }}
      />
    </div>
  );
}
