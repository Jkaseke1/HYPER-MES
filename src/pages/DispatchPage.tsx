import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Truck, MapPin, Package, AlertTriangle, FileText, X, Scale, Hash, Warehouse as WarehouseIcon, Calendar, User, Route, Clock, CheckCircle2, Box, ArrowRight, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { generateDispatchNumber } from '../lib/batchNumberGenerator';
import type { DispatchOrder, DispatchItem, Branch, Warehouse, Formulation } from '../types/database';
import Modal from '../components/ui/Modal';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
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

const EMPTY_ITEM = { formulation_id: '', batch_number: '', quantity: 0, unit: 'kg' };

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
  loading: { label: 'Loading', color: 'text-blue-700', bg: 'bg-blue-50', icon: Box },
  dispatched: { label: 'Dispatched', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: Truck },
  in_transit: { label: 'In Transit', color: 'text-purple-700', bg: 'bg-purple-50', icon: Route },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', icon: AlertTriangle },
};

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
  const [showPickingSlip, setShowPickingSlip] = useState(false);
  const [pickingSlipOrder, setPickingSlipOrder] = useState<DispatchOrder | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    let q = supabase.from('dispatch_orders').select('*, branches(name, code), warehouses(name, code)').order('created_at', { ascending: false });
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
        const defaultWarehouse = w.data.find(wh => wh.code === 'DEB') || w.data.find(wh => wh.code === 'DSP');
        if (defaultWarehouse) {
          setForm(prev => ({ ...prev, warehouse_id: defaultWarehouse.id }));
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

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.dispatch_number.toLowerCase().includes(s) || o.driver_name.toLowerCase().includes(s) || o.vehicle_number.toLowerCase().includes(s) || (o.branches as any)?.name?.toLowerCase().includes(s);
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inTransit: orders.filter(o => o.status === 'in_transit' || o.status === 'dispatched').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalWeight: orders.reduce((s, o) => s + (o.total_weight || 0), 0),
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (editingOrderId) {
        const { error: updateError } = await supabase.from('dispatch_orders').update({ ...form, total_weight: totalWeight }).eq('id', editingOrderId);
        if (updateError) throw updateError;
        await supabase.from('dispatch_items').delete().eq('dispatch_order_id', editingOrderId);
        const rows = items.filter((i) => i.formulation_id).map((i) => ({ dispatch_order_id: editingOrderId, formulation_id: i.formulation_id, batch_number: i.batch_number, quantity: i.quantity, unit: i.unit, unit_price: 0, line_total: 0 }));
        if (rows.length) await supabase.from('dispatch_items').insert(rows);
      } else {
        const generatedNumber = await generateDispatchNumber();
        const { data, error } = await supabase.from('dispatch_orders').insert({ ...form, dispatch_number: generatedNumber, status: 'pending', total_weight: totalWeight, total_value: 0 }).select().single();
        if (!error && data) {
          const rows = items.filter((i) => i.formulation_id).map((i) => ({ dispatch_order_id: data.id, formulation_id: i.formulation_id, batch_number: i.batch_number, quantity: i.quantity, unit: i.unit, unit_price: 0, line_total: 0 }));
          if (rows.length) await supabase.from('dispatch_items').insert(rows);
        }
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error saving dispatch order:', error);
      alert(`Failed to save dispatch order: ${error.message}`);
    } finally {
      setSaving(false);
      setShowCreate(false);
      setEditingOrderId(null);
      resetForm();
      setDispatchNumber('');
      fetchOrders();
    }
  };

  const handleEdit = async (order: DispatchOrder) => {
    setViewOrder(null);
    const { data: editItems } = await supabase.from('dispatch_items').select('*, formulations(id, name, sage_code)').eq('dispatch_order_id', order.id);
    setForm({
      branch_id: order.branch_id,
      warehouse_id: order.warehouse_id,
      dispatch_date: format(new Date(order.dispatch_date), 'yyyy-MM-dd'),
      vehicle_number: order.vehicle_number || '',
      driver_name: order.driver_name || '',
      delivery_notes: order.delivery_notes || '',
    });
    if (editItems && editItems.length > 0) {
      setItems(editItems.map((i: any) => ({ formulation_id: i.formulation_id, batch_number: i.batch_number || '', quantity: i.quantity, unit: i.unit || 'kg' })));
      for (const i of editItems) {
        if (i.formulation_id) fetchFGStock(i.formulation_id);
      }
    } else {
      setItems([{ ...EMPTY_ITEM }]);
    }
    setEditingOrderId(order.id);
    setDispatchNumber(order.dispatch_number);
    setShowCreate(true);
  };

  const resetForm = () => {
    setForm(initForm);
    setItems([{ ...EMPTY_ITEM }]);
    const defaultWarehouse = warehouses.find(wh => wh.code === 'DEB') || warehouses.find(wh => wh.code === 'DSP');
    if (defaultWarehouse) {
      setForm(prev => ({ ...prev, warehouse_id: defaultWarehouse.id }));
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
    const { data: formulation } = await supabase
      .from('formulations')
      .select('sage_code')
      .eq('id', formulationId)
      .single();
    if (!formulation?.sage_code) return;
    const DEB_SAGE_WAREHOUSE_ID = 17;
    const { data: sageStock } = await supabase
      .from('sage_stock_balances')
      .select('quantity')
      .eq('sage_code', formulation.sage_code)
      .eq('warehouse_id', DEB_SAGE_WAREHOUSE_ID)
      .single();
    setStockBalances(prev => ({ ...prev, [formulationId]: Number(sageStock?.quantity || 0) }));
  };

  const openView = async (order: DispatchOrder) => {
    setViewOrder(order);
    const { data } = await supabase.from('dispatch_items').select('*, formulations(name, code, sage_code)').eq('dispatch_order_id', order.id);
    if (data) setViewItems(data as DispatchItem[]);
  };

  const updateStatus = async (id: string, status: string) => {
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

  const STATUS_FLOW: Record<string, { label: string; next: string }> = {
    pending: { label: 'Start Loading', next: 'loading' },
    loading: { label: 'Mark Dispatched', next: 'dispatched' },
    dispatched: { label: 'In Transit', next: 'in_transit' },
    in_transit: { label: 'Mark Delivered', next: 'delivered' },
  };
  const nextStatus = (s: string) => STATUS_FLOW[s] || null;

  const statusIndex = (s: string) => ['pending', 'loading', 'dispatched', 'in_transit', 'delivered'].indexOf(s);
  const currentStatusIndex = viewOrder ? statusIndex(viewOrder.status) : -1;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dispatch Management</h1>
            <p className="text-sm text-slate-500 mt-1">Plan, track and deliver finished goods to branches.</p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingOrderId(null); setShowCreate(true); }}
            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Dispatch
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Dispatches</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.pending.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider">On The Road</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.inTransit.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Route className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Weight</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalWeight.toLocaleString()} <span className="text-sm font-medium text-slate-500">kg</span></p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Scale className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === t.key
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dispatch, branch, vehicle or driver..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  {['Dispatch #', 'Branch', 'Date', 'Vehicle', 'Driver', 'Weight', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                          {o.dispatch_number.split('-').pop()?.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{o.dispatch_number}</p>
                          <p className="text-xs text-slate-400">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{(o.branches as any)?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{o.vehicle_number || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{o.driver_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{o.total_weight.toLocaleString()} kg</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setPickingSlipOrder(o); setShowPickingSlip(true); }}
                          className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Picking Slip"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {nextStatus(o.status) && (
                          <button
                            onClick={() => updateStatus(o.id, nextStatus(o.status)!.next)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            {nextStatus(o.status)!.label}
                          </button>
                        )}
                        <button
                          onClick={() => openView(o)}
                          className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Truck className="w-12 h-12 mb-3 text-slate-300" />
                        <p className="text-sm font-medium">No dispatch orders found</p>
                        <p className="text-xs mt-1">Try adjusting your search or create a new dispatch.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-6xl w-[98vw] h-[92vh] max-h-[92vh] p-0 sm:!max-w-6xl flex flex-col border-0 shadow-2xl rounded-2xl overflow-hidden [&>button.absolute]:hidden">
          <div className="shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Create Dispatch Order</h2>
                  <p className="text-slate-400 text-xs">Schedule finished goods delivery and assign branch, vehicle and driver</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium border border-white/20">Pending</span>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/80 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-teal-200/60 bg-white px-5 py-4 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Total Weight</p>
                  <p className="text-2xl font-bold text-slate-900">{totalWeight.toLocaleString()} <span className="text-sm font-medium text-slate-500">kg</span></p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Hash className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Items</p>
                  <p className="text-2xl font-bold text-slate-900">{items.filter(i => i.formulation_id).length}</p>
                </div>
              </div>
            </div>

            {/* Dispatch Details */}
            <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dispatch Details</h3>
                <Badge variant="outline" className="ml-auto text-[11px]">Destination</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Dispatch #</label>
                  <input type="text" value={dispatchNumber || 'Auto-generated'} disabled className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
                  <p className="text-[11px] text-slate-400">System generated</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Branch <span className="text-red-500">*</span></label>
                  <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white">
                    <option value="">Select branch</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Source Warehouse</label>
                  <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white">
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Dispatch Date</label>
                  <input type="date" value={form.dispatch_date} onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" />
                </div>
              </div>
            </div>

            {/* Transport */}
            <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Transport Details</h3>
                <Badge variant="outline" className="ml-auto text-[11px]">Logistics</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Vehicle Number</label>
                  <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" placeholder="e.g. ABC 1234" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Driver Name</label>
                  <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" placeholder="e.g. John Doe" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Delivery Notes</label>
                  <input value={form.delivery_notes} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" placeholder="Special instructions..." />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dispatch Items</h3>
                <Badge variant="outline" className="ml-auto text-[11px]">Finished Goods</Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Product', 'Batch Number', 'Qty', 'Unit', 'Stock'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 min-w-[240px]">
                          <select value={item.formulation_id} onChange={(e) => updateItem(idx, 'formulation_id', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white">
                            <option value="">Select product</option>
                            {formulations.map((f) => <option key={f.id} value={f.id}>{f.sage_code} — {f.name}</option>)}
                          </select>
                          {item.formulation_id && (
                            <p className={`text-xs mt-2 font-semibold ${(stockBalances[item.formulation_id] ?? 0) > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              Available: {stockBalances[item.formulation_id] !== undefined ? `${stockBalances[item.formulation_id].toLocaleString()} kg` : '…'}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-[180px]">
                          {batchNumbers[item.formulation_id]?.length ? (
                            <select value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white">
                              <option value="">Select batch</option>
                              {batchNumbers[item.formulation_id].map((bn) => <option key={bn} value={bn}>{bn}</option>)}
                            </select>
                          ) : (
                            <input value={item.batch_number} onChange={(e) => updateItem(idx, 'batch_number', e.target.value)} placeholder="e.g. BATCH-2026-103" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" />
                          )}
                        </td>
                        <td className="px-4 py-3"><input type="number" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', +e.target.value)} className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white" /></td>
                        <td className="px-4 py-3">
                          <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-white">
                            {['kg', 'bags', 'tons'].map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 min-w-[120px]">
                          {item.formulation_id && item.quantity > 0 && (
                            <div className="text-xs space-y-0.5">
                              <div className="text-slate-500">Current: <span className="font-semibold text-slate-700">{stockBalances[item.formulation_id] !== undefined ? `${stockBalances[item.formulation_id].toLocaleString()} kg` : '…'}</span></div>
                              <div className="text-slate-500">After: <span className="font-semibold text-amber-600">{stockBalances[item.formulation_id] !== undefined ? `${(stockBalances[item.formulation_id] - item.quantity).toLocaleString()} kg` : '…'}</span></div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button onClick={() => setItems([...items, { ...EMPTY_ITEM }])} className="flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-xl transition-colors">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
                <div className="flex gap-6 text-sm">
                  <span className="text-slate-500">Total Weight: <strong className="text-slate-900">{totalWeight.toLocaleString()} kg</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.branch_id} className="px-5 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2">
              <Truck className="w-4 h-4" />
              {saving ? 'Saving...' : editingOrderId ? 'Update Dispatch' : 'Save Dispatch'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Modal — Full-width professional layout */}
      <Dialog open={!!viewOrder} onOpenChange={(v) => { if (!v) setViewOrder(null); }}>
        <DialogContent className="max-w-7xl w-[98vw] h-[92vh] max-h-[92vh] p-0 sm:!max-w-7xl flex flex-col border-0 shadow-2xl rounded-2xl overflow-hidden [&>button.absolute]:hidden">
          {viewOrder && (
            <>
              {/* Header bar */}
              <div className="shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{viewOrder.dispatch_number}</h2>
                      <div className="flex items-center gap-2 text-slate-400 text-xs mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(viewOrder.dispatch_date), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={viewOrder.status} />
                    <button
                      onClick={() => setViewOrder(null)}
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/80 space-y-6">
                {/* Action bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => { setPickingSlipOrder(viewOrder); setShowPickingSlip(true); }} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200">
                      <FileText className="w-4 h-4" />
                      Picking Slip
                    </button>
                    {viewOrder.status === 'pending' && (
                      <button onClick={() => handleEdit(viewOrder)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200">
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {viewOrder.status === 'pending' && (
                      <button onClick={() => deleteOrder(viewOrder)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200">
                        <AlertTriangle className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                  {nextStatus(viewOrder.status) && (
                    <button
                      onClick={() => updateStatus(viewOrder.id, nextStatus(viewOrder.status)!.next)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all active:scale-95"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {nextStatus(viewOrder.status)!.label}
                    </button>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    {['pending', 'loading', 'dispatched', 'in_transit', 'delivered'].map((s, i) => {
                      const isActive = i <= currentStatusIndex;
                      const isCurrent = i === currentStatusIndex;
                      const Icon = STATUS_META[s]?.icon || Clock;
                      return (
                        <div key={s} className="flex flex-col items-center gap-2 flex-1 relative">
                          {i < 4 && (
                            <div className={`absolute top-5 left-1/2 w-full h-0.5 ${isActive && i < currentStatusIndex ? 'bg-teal-300' : 'bg-slate-200'}`} />
                          )}
                          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isCurrent ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-600/30' : isActive ? 'bg-teal-100 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{STATUS_META[s]?.label || s}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destination Branch</p>
                      <p className="font-bold text-slate-800 mt-0.5 truncate">{(viewOrder.branches as any)?.name || '-'}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                      <WarehouseIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source Warehouse</p>
                      <p className="font-bold text-slate-800 mt-0.5">{(viewOrder.warehouses as any)?.name || '-'} <span className="text-slate-400 font-normal text-sm">({(viewOrder.warehouses as any)?.code || '-'})</span></p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vehicle / Driver</p>
                      <p className="font-bold text-slate-800 mt-0.5">{viewOrder.vehicle_number || '-'} <span className="text-slate-400 font-normal text-sm">/ {viewOrder.driver_name || '-'}</span></p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Weight</p>
                      <p className="font-bold text-slate-800 mt-0.5">{viewOrder.total_weight.toLocaleString()} kg</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Notes */}
                {viewOrder.delivery_notes && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Delivery Notes</p>
                      <p className="text-sm text-amber-900 mt-1">{viewOrder.delivery_notes}</p>
                    </div>
                  </div>
                )}

                {/* Approval buttons (pending only) */}
                {viewOrder.status === 'pending' && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                    <ApprovalButtons
                      entityType="dispatch_order"
                      entityId={viewOrder.id}
                      currentStatus={viewOrder.status}
                      approveStatus="loading"
                      rejectStatus="cancelled"
                      onApproved={() => { setViewOrder(null); fetchOrders(); }}
                      onRejected={() => { setViewOrder(null); fetchOrders(); }}
                    />
                  </div>
                )}

                {/* Rejection reason */}
                {viewOrder.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700">{viewOrder.rejection_reason}</p>
                  </div>
                )}

                {/* Dispatch Items */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                      <Package className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dispatch Items</h3>
                    <Badge variant="outline" className="ml-auto text-[11px]">{viewItems.length} items</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['Product', 'Batch', 'Qty', 'Unit'].map((h) => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {viewItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 text-slate-700 font-medium">{(item.formulations as any)?.name || '-'}</td>
                            <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{item.batch_number}</td>
                            <td className="px-5 py-3.5 text-slate-700 font-semibold">{item.quantity}</td>
                            <td className="px-5 py-3.5 text-slate-600">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Approval History */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                  <ApprovalHistory entityType="dispatch_order" entityId={viewOrder.id} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Picking Slip Modal */}
      <Modal open={showPickingSlip} onClose={() => { setShowPickingSlip(false); setPickingSlipOrder(null); }} title="Picking Slip" size="2xl">
        {pickingSlipOrder && viewItems.length > 0 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">PICKING SLIP</h3>
                  <p className="text-sm text-slate-500">Dispatch: {pickingSlipOrder.dispatch_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Date</p>
                  <p className="text-sm font-semibold text-slate-700">{format(new Date(pickingSlipOrder.dispatch_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                  <p className="text-xs text-slate-400 uppercase">Branch</p>
                  <p className="font-semibold text-slate-800">{(pickingSlipOrder.branches as any)?.name || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                  <p className="text-xs text-slate-400 uppercase">Vehicle / Driver</p>
                  <p className="font-semibold text-slate-800">{pickingSlipOrder.vehicle_number} / {pickingSlipOrder.driver_name}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Items to Pick</h4>
              <table className="w-full text-sm border border-slate-200/70 rounded-2xl overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Batch</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Unit</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Picked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700 font-medium">{(item.formulations as any)?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{item.batch_number}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-semibold">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70">
              <div className="text-sm">
                <p className="text-xs text-slate-400 uppercase">Total Weight</p>
                <p className="text-lg font-bold text-slate-800">{pickingSlipOrder.total_weight.toLocaleString()} kg</p>
              </div>
            </div>

            {pickingSlipOrder.delivery_notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-1">Delivery Notes</p>
                <p className="text-sm text-amber-700">{pickingSlipOrder.delivery_notes}</p>
              </div>
            )}

            <div className="border-t border-slate-200 pt-5 flex justify-between">
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-semibold text-sm">
                <FileText className="w-4 h-4" />
                Print Slip
              </button>
              <button onClick={() => { setShowPickingSlip(false); setPickingSlipOrder(null); }} className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
