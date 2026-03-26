import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Truck, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { DispatchOrder, DispatchItem, Branch, Warehouse, Formulation } from '../types/database';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ApprovalButtons from '../components/approval/ApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';

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
        supabase.from('warehouses').select('*').eq('is_active', true).eq('type', 'finished_goods').order('name'),
        supabase.from('formulations').select('*').eq('status', 'active').order('name'),
      ]);
      if (b.data) setBranches(b.data);
      if (w.data) setWarehouses(w.data);
      if (f.data) setFormulations(f.data);
    };
    load();
  }, []);

  const totalWeight = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.dispatch_number.toLowerCase().includes(s) || o.driver_name.toLowerCase().includes(s) || o.vehicle_number.toLowerCase().includes(s) || (o.branches as any)?.name?.toLowerCase().includes(s);
  });

  const handleCreate = async () => {
    setSaving(true);
    const dispatchNumber = `DSP-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from('dispatch_orders').insert({ ...form, dispatch_number: dispatchNumber, status: 'pending', total_weight: totalWeight, total_value: totalValue }).select().single();
    if (!error && data) {
      const rows = items.filter((i) => i.formulation_id).map((i) => ({ dispatch_order_id: data.id, formulation_id: i.formulation_id, batch_number: i.batch_number, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, line_total: i.quantity * i.unit_price }));
      if (rows.length) await supabase.from('dispatch_items').insert(rows);
    }
    setSaving(false);
    setShowCreate(false);
    resetForm();
    fetchOrders();
  };

  const resetForm = () => { setForm(initForm); setItems([{ ...EMPTY_ITEM }]); };

  const openView = async (order: DispatchOrder) => {
    setViewOrder(order);
    const { data } = await supabase.from('dispatch_items').select('*, formulations(name, code)').eq('dispatch_order_id', order.id);
    if (data) setViewItems(data as DispatchItem[]);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    await supabase.from('dispatch_orders').update(updates).eq('id', id);
    if (viewOrder?.id === id) setViewOrder({ ...viewOrder, ...updates });
    fetchOrders();
  };

  const STATUS_FLOW: Record<string, { label: string; next: string }> = { pending: { label: 'Start Loading', next: 'loading' }, loading: { label: 'Mark Dispatched', next: 'dispatched' }, dispatched: { label: 'In Transit', next: 'in_transit' }, in_transit: { label: 'Mark Delivered', next: 'delivered' } };
  const nextStatus = (s: string) => STATUS_FLOW[s] || null;

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = items.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
    setItems(updated);
  };

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
                        <option value="">Select</option>
                        {formulations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5"><input value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" /></td>
                    <td className="px-3 py-1.5"><input type="number" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', +e.target.value)} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" /></td>
                    <td className="px-3 py-1.5">
                      <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        {['kg', 'bags', 'tons'].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5"><input type="number" value={item.unit_price || ''} onChange={(e) => updateItem(idx, 'unit_price', +e.target.value)} className="w-24 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" /></td>
                    <td className="px-3 py-1.5 text-slate-600">{(item.quantity * item.unit_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span className="text-slate-600">Total Weight: <strong className="text-slate-800">{totalWeight.toLocaleString()} kg</strong></span>
              <span className="text-slate-600">Total Value: <strong className="text-slate-800">{totalValue.toLocaleString()}</strong></span>
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
                <div><p className="text-xs text-slate-500">Weight / Value</p><p className="text-sm font-medium text-slate-700">{viewOrder.total_weight.toLocaleString()} kg / {viewOrder.total_value.toLocaleString()}</p></div>
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
                      <td className="px-3 py-2 text-slate-600">{item.unit_price.toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{item.line_total.toLocaleString()}</td>
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
    </div>
  );
}
