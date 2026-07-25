import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Eye, Truck, MapPin, Package, AlertTriangle, FileText, X, Scale, Hash,
  Warehouse as WarehouseIcon, Calendar, User, Route, Clock, CheckCircle2, Box, ArrowRight,
  Pencil, Sparkles, Printer, RefreshCw, ShieldAlert, ArrowUpRight
} from 'lucide-react';
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
  { key: 'all', label: 'All Dispatches' },
  { key: 'pending', label: 'Pending' },
  { key: 'loading', label: 'Loading' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const EMPTY_ITEM = { formulation_id: '', batch_number: '', quantity: 0, unit: 'kg' };

const STAGES = [
  { key: 'pending', label: 'Pending', icon: Clock, desc: 'Created & Queueing' },
  { key: 'loading', label: 'Loading', icon: Box, desc: 'Vehicle Loading' },
  { key: 'dispatched', label: 'Dispatched', icon: Truck, desc: 'Left Warehouse' },
  { key: 'in_transit', label: 'In Transit', icon: Route, desc: 'On Delivery Route' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Received at Branch' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  loading: { label: 'Loading', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Box },
  dispatched: { label: 'Dispatched', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: Truck },
  in_transit: { label: 'In Transit', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Route },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: AlertTriangle },
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
    let q = supabase.from('dispatch_orders').select('*, branches(name, code, sage_code), warehouses(name, code)').order('created_at', { ascending: false });
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
    return (
      o.dispatch_number.toLowerCase().includes(s) ||
      o.driver_name.toLowerCase().includes(s) ||
      o.vehicle_number.toLowerCase().includes(s) ||
      (o.branches as any)?.name?.toLowerCase().includes(s)
    );
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    loading: orders.filter(o => o.status === 'loading').length,
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

  const STATUS_FLOW: Record<string, { label: string; next: string; icon: any }> = {
    pending: { label: 'Start Loading', next: 'loading', icon: Box },
    loading: { label: 'Mark Dispatched', next: 'dispatched', icon: Truck },
    dispatched: { label: 'In Transit', next: 'in_transit', icon: Route },
    in_transit: { label: 'Confirm Delivery', next: 'delivered', icon: CheckCircle2 },
  };
  const nextStatus = (s: string) => STATUS_FLOW[s] || null;

  const statusIndex = (s: string) => ['pending', 'loading', 'dispatched', 'in_transit', 'delivered'].indexOf(s);
  const currentStatusIndex = viewOrder ? statusIndex(viewOrder.status) : -1;

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                <Truck className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Dispatch Logistics Hub</h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    <Sparkles className="w-3.5 h-3.5" /> Sage Integrated
                  </span>
                </div>
                <p className="text-slate-300 text-xs md:text-sm mt-1">
                  Schedule finished feed transfers, monitor active transit routes, and automate Sage stock delivery postings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchOrders}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all text-white"
                title="Refresh Dispatches"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => { resetForm(); setEditingOrderId(null); setShowCreate(true); }}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-95 text-sm"
              >
                <Plus className="w-5 h-5" />
                New Dispatch Order
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400">All registered trips</span>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200/80 bg-amber-50/20 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-amber-900 mt-2">{stats.pending.toLocaleString()}</p>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting loading</span>
          </div>

          <div className="bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Loading Dock</span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <Box className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-blue-900 mt-2">{stats.loading.toLocaleString()}</p>
            <span className="text-[10px] text-blue-600 font-medium">Currently loading</span>
          </div>

          <div className="bg-white rounded-2xl border border-purple-200/80 bg-purple-50/20 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">On The Road</span>
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                <Route className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-purple-900 mt-2">{stats.inTransit.toLocaleString()}</p>
            <span className="text-[10px] text-purple-600 font-medium">Dispatched & in-transit</span>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 shadow-sm hover:shadow-md transition-shadow col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Delivered Weight</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-900 mt-2">{(stats.totalWeight / 1000).toFixed(2)} <span className="text-xs font-normal text-emerald-600">t</span></p>
            <span className="text-[10px] text-emerald-600 font-mono">{stats.totalWeight.toLocaleString()} kg total</span>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t.key
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
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
                placeholder="Search dispatch #, branch, driver, vehicle..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white uppercase tracking-wider font-semibold">
                <tr>
                  <th className="text-left px-5 py-3.5">Dispatch # & Date</th>
                  <th className="text-left px-5 py-3.5">Destination Branch</th>
                  <th className="text-left px-5 py-3.5">Vehicle & Driver</th>
                  <th className="text-left px-5 py-3.5">Weight (kg)</th>
                  <th className="text-left px-5 py-3.5">Active Stage</th>
                  <th className="text-right px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => {
                  const meta = STATUS_META[o.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  const flow = nextStatus(o.status);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black font-mono text-xs border border-slate-700">
                            {o.dispatch_number.split('-').pop()?.slice(0, 3)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 font-mono">{o.dispatch_number}</p>
                            <p className="text-[11px] text-slate-400">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="font-bold text-slate-800">{(o.branches as any)?.name || '-'}</span>
                          {(o.branches as any)?.sage_code && (
                            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {(o.branches as any)?.sage_code}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            {o.vehicle_number || 'Unassigned'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {o.driver_name || 'No driver assigned'}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-extrabold text-slate-900 font-mono text-sm">{o.total_weight.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 ml-1">kg</span>
                        <p className="text-[10px] text-slate-400">({(o.total_weight / 1000).toFixed(2)} t)</p>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setPickingSlipOrder(o); openView(o); setShowPickingSlip(true); }}
                            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 transition-colors"
                            title="Picking Slip"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {flow && (
                            <button
                              onClick={() => updateStatus(o.id, flow.next)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95"
                            >
                              <flow.icon className="w-3.5 h-3.5" />
                              {flow.label}
                            </button>
                          )}

                          <button
                            onClick={() => openView(o)}
                            className="inline-flex items-center gap-1 p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                            title="View Dispatch Timeline"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Truck className="w-12 h-12 mb-3 text-slate-300 animate-pulse" />
                        <p className="text-sm font-bold text-slate-700">No dispatch orders found</p>
                        <p className="text-xs mt-1 text-slate-400">Try adjusting your tab filter or create a new dispatch order.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="grid grid-cols-1 gap-3.5 md:hidden">
          {filtered.map((o) => {
            const meta = STATUS_META[o.status] || STATUS_META.pending;
            const Icon = meta.icon;
            const flow = nextStatus(o.status);

            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="font-extrabold text-slate-900 font-mono text-sm">{o.dispatch_number}</span>
                    <p className="text-[10px] text-slate-400">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Destination</span>
                    <p className="font-bold text-slate-800">{o.branches?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Weight</span>
                    <p className="font-bold text-slate-900 font-mono">{o.total_weight.toLocaleString()} kg</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</span>
                    <p className="font-medium text-slate-700">{o.vehicle_number || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Driver</span>
                    <p className="font-medium text-slate-700">{o.driver_name || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {flow && (
                    <button
                      onClick={() => updateStatus(o.id, flow.next)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 text-white"
                    >
                      <flow.icon className="w-3.5 h-3.5" /> {flow.label}
                    </button>
                  )}
                  <button
                    onClick={() => openView(o)}
                    className="p-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Create / Edit Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-5xl w-[98vw] h-[92vh] max-h-[92vh] p-0 sm:!max-w-5xl flex flex-col border-0 shadow-2xl rounded-3xl overflow-hidden [&>button.absolute]:hidden">
          {/* Dark Header Banner */}
          <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">
                    {editingOrderId ? `Edit Dispatch Order (${dispatchNumber})` : 'New Dispatch Order'}
                  </h2>
                  <p className="text-slate-300 text-xs">Schedule finished feed delivery to branch warehouse</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/80 space-y-5">
            {/* KPI Summary strip */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-white border border-teal-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Total Dispatch Weight</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-0.5">{totalWeight.toLocaleString()} <span className="text-xs font-normal text-slate-500">kg</span></p>
                </div>
                <Scale className="w-6 h-6 text-teal-600" />
              </div>
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Items</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-0.5">{items.filter(i => i.formulation_id).length}</p>
                </div>
                <Package className="w-6 h-6 text-slate-400" />
              </div>
            </div>

            {/* Logistics & Route Setup */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Logistics & Route Setup</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">Destination</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Dispatch #</label>
                  <input
                    type="text"
                    value={dispatchNumber || 'Auto-generated'}
                    disabled
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50 font-mono text-slate-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Destination Branch *</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  >
                    <option value="">Select destination branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.sage_code || 'No Code'})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Source Warehouse</label>
                  <select
                    value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Dispatch Date</label>
                  <input
                    type="date"
                    value={form.dispatch_date}
                    onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Vehicle Number</label>
                  <input
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                    placeholder="e.g. ABG 1234"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Driver Name</label>
                  <input
                    value={form.driver_name}
                    onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Delivery Notes</label>
                  <input
                    value={form.delivery_notes}
                    onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                    placeholder="Instructions..."
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dispatch Products & Quantities</h3>
                </div>
                <button
                  onClick={() => setItems([...items, { ...EMPTY_ITEM }])}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Product Formulation</label>
                      <select
                        value={item.formulation_id}
                        onChange={(e) => updateItem(idx, 'formulation_id', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                      >
                        <option value="">Select product...</option>
                        {formulations.map((f) => (
                          <option key={f.id} value={f.id}>{f.sage_code} — {f.name}</option>
                        ))}
                      </select>
                      {item.formulation_id && (
                        <p className={`text-[10px] font-bold ${stockBalances[item.formulation_id] > 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                          Sage DEB Stock: {stockBalances[item.formulation_id] !== undefined ? `${stockBalances[item.formulation_id].toLocaleString()} kg` : '…'}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Batch Number</label>
                      {batchNumbers[item.formulation_id]?.length ? (
                        <select
                          value={item.batch_number}
                          onChange={(e) => updateItem(idx, 'batch_number', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white"
                        >
                          <option value="">Select batch...</option>
                          {batchNumbers[item.formulation_id].map((bn) => (
                            <option key={bn} value={bn}>{bn}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={item.batch_number}
                          onChange={(e) => updateItem(idx, 'batch_number', e.target.value)}
                          placeholder="e.g. BATCH-2026-001"
                          className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase">Qty (kg)</label>
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(idx, 'quantity', +e.target.value)}
                        className="w-full border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-extrabold bg-emerald-50/50 text-emerald-900"
                        placeholder="0"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      >
                        <option value="kg font-bold">kg</option>
                        <option value="bags">bags</option>
                        <option value="tons">tons</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Total Dispatch: <strong className="text-emerald-700 font-mono text-sm">{totalWeight.toLocaleString()} kg</strong></span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.branch_id}
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                {saving ? 'Saving...' : editingOrderId ? 'Update Dispatch' : 'Save & Create Dispatch'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Detail Modal with Active Movement Tracker */}
      <Dialog open={!!viewOrder} onOpenChange={(v) => { if (!v) setViewOrder(null); }}>
        <DialogContent className="max-w-6xl w-[98vw] h-[92vh] max-h-[92vh] p-0 sm:!max-w-6xl flex flex-col border-0 shadow-2xl rounded-3xl overflow-hidden [&>button.absolute]:hidden">
          {viewOrder && (
            <>
              {/* Header */}
              <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-4 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Truck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black font-mono tracking-tight">{viewOrder.dispatch_number}</h2>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                          {(viewOrder.branches as any)?.name || 'Branch'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Dispatch Date: {format(new Date(viewOrder.dispatch_date), 'dd MMM yyyy')} • Vehicle: {viewOrder.vehicle_number || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewOrder(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/80 space-y-6">

                {/* ACTIVE MOVEMENT TRACKER / STAGE TIMELINE */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Route className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Stage & Transit Movement Progress</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                      Step {currentStatusIndex + 1} of 5
                    </Badge>
                  </div>

                  <div className="grid grid-cols-5 gap-2 relative">
                    {STAGES.map((stage, idx) => {
                      const isPast = idx < currentStatusIndex;
                      const isCurrent = idx === currentStatusIndex;
                      const Icon = stage.icon;

                      return (
                        <div key={stage.key} className="flex flex-col items-center text-center space-y-2 relative z-10">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all shadow-sm ${
                              isCurrent
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-teal-600 text-white ring-4 ring-emerald-500/20 scale-105'
                                : isPast
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={`text-xs font-extrabold ${isCurrent ? 'text-emerald-900' : isPast ? 'text-slate-800' : 'text-slate-400'}`}>
                              {stage.label}
                            </p>
                            <p className="text-[10px] text-slate-400 hidden sm:block">{stage.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPickingSlipOrder(viewOrder); setShowPickingSlip(true); }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    >
                      <FileText className="w-3.5 h-3.5" /> Print Picking Slip
                    </button>
                    {viewOrder.status === 'pending' && (
                      <button
                        onClick={() => handleEdit(viewOrder)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Order
                      </button>
                    )}
                  </div>

                  {nextStatus(viewOrder.status) && (
                    <button
                      onClick={() => updateStatus(viewOrder.id, nextStatus(viewOrder.status)!.next)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Advance to {nextStatus(viewOrder.status)!.label}
                    </button>
                  )}
                </div>

                {/* Transport & Route Details Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination Branch</span>
                    <p className="font-extrabold text-slate-900">{viewOrder.branches?.name || '-'}</p>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block mt-1">
                      {viewOrder.branches?.sage_code || 'No Code'}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Warehouse</span>
                    <p className="font-extrabold text-slate-900">{viewOrder.warehouses?.name || 'Dispatch (DEB)'}</p>
                    <span className="text-[10px] text-slate-500">WhseID: 17/20</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle & Driver</span>
                    <p className="font-extrabold text-slate-900">{viewOrder.vehicle_number || 'Unassigned'}</p>
                    <p className="text-[11px] text-slate-500">{viewOrder.driver_name || 'No Driver'}</p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatch Weight</span>
                    <p className="font-extrabold text-emerald-900 font-mono text-lg">{viewOrder.total_weight.toLocaleString()} kg</p>
                    <span className="text-[10px] text-emerald-600">({(viewOrder.total_weight / 1000).toFixed(2)} tonnes)</span>
                  </div>
                </div>

                {/* Delivery Notes */}
                {viewOrder.delivery_notes && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Delivery Notes / Special Instructions:</span>
                      <p className="mt-0.5 text-amber-900">{viewOrder.delivery_notes}</p>
                    </div>
                  </div>
                )}

                {/* Line Items Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dispatched Line Items ({viewItems.length})</h3>
                    <span className="text-xs font-mono font-bold text-emerald-700">Total: {viewOrder.total_weight.toLocaleString()} kg</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-900 text-white uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="text-left px-4 py-2.5">Product Formulation</th>
                          <th className="text-left px-4 py-2.5">Sage Code</th>
                          <th className="text-left px-4 py-2.5">Batch #</th>
                          <th className="text-right px-4 py-2.5">Quantity (kg)</th>
                          <th className="text-left px-4 py-2.5">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-bold text-slate-900">{item.formulations?.name || '-'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-700">{item.formulations?.sage_code || '-'}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{item.batch_number || 'Unassigned'}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-slate-900 font-mono">{item.quantity.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-600">{item.unit || 'kg'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Approval History */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
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

      {/* Picking Slip Printable Modal */}
      <Modal open={showPickingSlip} onClose={() => { setShowPickingSlip(false); setPickingSlipOrder(null); }} title="Picking Slip" size="2xl">
        {pickingSlipOrder && viewItems.length > 0 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">DISPATCH PICKING SLIP</h3>
                  <p className="text-xs font-mono text-slate-500">Dispatch #: {pickingSlipOrder.dispatch_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Dispatch Date</p>
                  <p className="text-sm font-bold text-slate-800">{format(new Date(pickingSlipOrder.dispatch_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Destination Branch</p>
                  <p className="font-extrabold text-slate-900">{pickingSlipOrder.branches?.name || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Vehicle / Driver</p>
                  <p className="font-extrabold text-slate-900">{pickingSlipOrder.vehicle_number || '-'} / {pickingSlipOrder.driver_name || '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Items to Pick & Load</h4>
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-900 text-white uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5">Product</th>
                    <th className="text-left px-4 py-2.5">Batch</th>
                    <th className="text-right px-4 py-2.5">Qty (kg)</th>
                    <th className="text-center px-4 py-2.5">Picked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{item.formulations?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{item.batch_number}</td>
                      <td className="px-4 py-3 text-right text-slate-900 font-extrabold font-mono">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl shadow"
              >
                <Printer className="w-3.5 h-3.5" /> Print Slip
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
