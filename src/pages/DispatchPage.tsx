import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Eye, Truck, MapPin, Package, AlertTriangle, FileText, X, Scale,
  Warehouse as WarehouseIcon, Calendar, User, Route, Clock, CheckCircle2, Box, ArrowRight,
  Pencil, Sparkles, Printer, RefreshCw, Building, ShieldCheck, DollarSign, Check, Phone, FileCheck
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
import DeliveryNoteModal from '../components/dispatch/DeliveryNoteModal';

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

// Preset drivers and fleet for fast entry
const FLEET_TRUCKS = ['ABG 1234', 'AES 5678', 'AFG 9012', 'AHL 3456', 'AGE 7890'];
const FLEET_DRIVERS = ['P. Tembo', 'S. Mujele', 'J. Kaseke', 'M. Moyo', 'T. Ndlovu'];

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

  // D-Note Modal State
  const [showDNote, setShowDNote] = useState(false);
  const [dnoteOrder, setDNoteOrder] = useState<DispatchOrder | null>(null);
  const [dnoteItems, setDNoteItems] = useState<DispatchItem[]>([]);

  // Branch Confirmation Modal State
  const [showBranchConfirmModal, setShowBranchConfirmModal] = useState(false);
  const [branchConfirmOrder, setBranchConfirmOrder] = useState<DispatchOrder | null>(null);
  const [branchNotes, setBranchNotes] = useState('');

  // Accounts Approval Modal State
  const [showAccountsApproveModal, setShowAccountsApproveModal] = useState(false);
  const [accountsApproveOrder, setAccountsApproveOrder] = useState<DispatchOrder | null>(null);
  const [accountsNotes, setAccountsNotes] = useState('');

  const initForm = {
    dispatch_type: 'branch_transfer' as 'branch_transfer' | 'customer_direct',
    customer_name: '',
    customer_code: '',
    branch_id: '',
    warehouse_id: '',
    dispatch_date: format(new Date(), 'yyyy-MM-dd'),
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
    is_hired_truck: false,
    transporter_name: '',
    trailer_number: '',
    physical_dnote_number: '',
    hfdn_reference: '',
    order_number: '',
    vat_number: '',
    delivery_notes: '',
  };

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
      o.driver_name?.toLowerCase().includes(s) ||
      o.vehicle_number?.toLowerCase().includes(s) ||
      o.physical_dnote_number?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
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
        const { error: updateError } = await supabase.from('dispatch_orders').update({ 
          ...form, 
          branch_id: form.dispatch_type === 'branch_transfer' ? form.branch_id : null,
          total_weight: totalWeight 
        }).eq('id', editingOrderId);
        if (updateError) throw updateError;
        await supabase.from('dispatch_items').delete().eq('dispatch_order_id', editingOrderId);
        const rows = items.filter((i) => i.formulation_id).map((i) => ({ dispatch_order_id: editingOrderId, formulation_id: i.formulation_id, batch_number: i.batch_number, quantity: i.quantity, unit: i.unit, unit_price: 0, line_total: 0 }));
        if (rows.length) await supabase.from('dispatch_items').insert(rows);
      } else {
        const generatedNumber = await generateDispatchNumber();
        const { data, error } = await supabase.from('dispatch_orders').insert({ 
          ...form, 
          branch_id: form.dispatch_type === 'branch_transfer' ? form.branch_id : null,
          dispatch_number: generatedNumber, 
          status: 'pending', 
          total_weight: totalWeight, 
          total_value: 0 
        }).select().single();
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
      dispatch_type: order.dispatch_type || 'branch_transfer',
      customer_name: order.customer_name || '',
      customer_code: order.customer_code || '',
      branch_id: order.branch_id || '',
      warehouse_id: order.warehouse_id || '',
      dispatch_date: format(new Date(order.dispatch_date), 'yyyy-MM-dd'),
      vehicle_number: order.vehicle_number || '',
      driver_name: order.driver_name || '',
      driver_phone: order.driver_phone || '',
      is_hired_truck: order.is_hired_truck || false,
      transporter_name: order.transporter_name || '',
      trailer_number: order.trailer_number || '',
      physical_dnote_number: order.physical_dnote_number || '',
      hfdn_reference: order.hfdn_reference || '',
      order_number: order.order_number || '',
      vat_number: order.vat_number || '',
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

  const openDNoteModal = async (order: DispatchOrder) => {
    setDNoteOrder(order);
    const { data } = await supabase.from('dispatch_items').select('*, formulations(name, code, sage_code)').eq('dispatch_order_id', order.id);
    if (data) setDNoteItems(data as DispatchItem[]);
    setShowDNote(true);
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

  // Branch Confirm Delivery Action
  const handleConfirmBranchDelivery = async () => {
    if (!branchConfirmOrder) return;
    setSaving(true);
    try {
      const updates = {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        branch_confirmation_status: 'confirmed',
        branch_confirmed_at: new Date().toISOString(),
        branch_confirmation_notes: branchNotes,
      };
      const { error } = await supabase.from('dispatch_orders').update(updates).eq('id', branchConfirmOrder.id);
      if (error) throw error;
      
      alert('Branch delivery confirmed successfully!');
      setShowBranchConfirmModal(false);
      setBranchConfirmOrder(null);
      setBranchNotes('');
      fetchOrders();
    } catch (err: any) {
      alert(`Failed to confirm branch delivery: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Accounts Approve & Post Action
  const handleAccountsApprovePosting = async () => {
    if (!accountsApproveOrder) return;
    setSaving(true);
    try {
      const updates = {
        accounts_posting_status: 'approved',
        accounts_approved_at: new Date().toISOString(),
        accounts_approval_notes: accountsNotes,
      };
      const { error } = await supabase.from('dispatch_orders').update(updates).eq('id', accountsApproveOrder.id);
      if (error) throw error;

      // Register Sage review event
      await supabase.from('sage_posting_reviews').insert({
        sync_event_id: accountsApproveOrder.id,
        event_type: 'dispatch_delivered',
        event_description: `Dispatch ${accountsApproveOrder.dispatch_number} Approved for Sage Posting`,
        sage_code: 'DSP-POST',
        transaction_type: accountsApproveOrder.dispatch_type === 'customer_direct' ? 'INV' : 'WHT',
        sage_tx_code: accountsApproveOrder.dispatch_type === 'customer_direct' ? 'INV' : 'WHT',
        quantity: accountsApproveOrder.total_weight,
        unit_cost: 0,
        total_value: accountsApproveOrder.total_value || 0,
        warehouse_id: 17,
        warehouse_code: 'DEB',
        reference: accountsApproveOrder.dispatch_number,
        reference2: accountsApproveOrder.physical_dnote_number || '',
        description: `Dispatch Posting (${accountsApproveOrder.dispatch_type})`,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      });

      alert('Accounts approval completed! Ready for posting / customer invoice.');
      setShowAccountsApproveModal(false);
      setAccountsApproveOrder(null);
      setAccountsNotes('');
      fetchOrders();
    } catch (err: any) {
      alert(`Failed to approve accounts posting: ${err.message}`);
    } finally {
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
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-slate-50/60 p-4 md:p-6 overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full space-y-4">

        {/* STATIC FIXED TOP SECTION */}
        <div className="shrink-0 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Dispatch Logistics & D-Note Hub</h1>
              <p className="text-xs text-slate-500">Driver assignments, hired trucks, official D-Notes, branch receipt & accounts invoicing.</p>
            </div>
          </div>

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <Truck className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold tracking-tight">Dispatch Logistics Hub</h2>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <Sparkles className="w-3 h-3" /> Official D-Note & Sage Integrated
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs mt-0.5">
                    Manage Drivers, Hired Transporters, Official D-Notes, Branch Confirmations, and Accounts Invoicing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchOrders}
                  className="p-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all text-white"
                  title="Refresh Dispatches"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { resetForm(); setEditingOrderId(null); setShowCreate(true); }}
                  className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  New Dispatch Order
                </button>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</span>
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Truck className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{stats.total.toLocaleString()}</p>
              <span className="text-[10px] text-slate-400">All registered trips</span>
            </div>

            <div className="bg-white rounded-xl border border-amber-200/80 bg-amber-50/20 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending</span>
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-amber-900 mt-1">{stats.pending.toLocaleString()}</p>
              <span className="text-[10px] text-amber-600 font-medium">Awaiting loading</span>
            </div>

            <div className="bg-white rounded-xl border border-blue-200/80 bg-blue-50/20 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Loading Dock</span>
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                  <Box className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-blue-900 mt-1">{stats.loading.toLocaleString()}</p>
              <span className="text-[10px] text-blue-600 font-medium">Currently loading</span>
            </div>

            <div className="bg-white rounded-xl border border-purple-200/80 bg-purple-50/20 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">On The Road</span>
                <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <Route className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-purple-900 mt-1">{stats.inTransit.toLocaleString()}</p>
              <span className="text-[10px] text-purple-600 font-medium">In-transit</span>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-3 shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Delivered Weight</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Scale className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-emerald-900 mt-1">{(stats.totalWeight / 1000).toFixed(2)} <span className="text-xs font-normal text-emerald-600">t</span></p>
              <span className="text-[10px] text-emerald-600 font-mono">{stats.totalWeight.toLocaleString()} kg</span>
            </div>
          </div>

          {/* Tab Navigation & Search */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                  placeholder="Search dispatch #, D-Note #, driver, truck..."
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SCROLLABLE TABLE / CONTENT SECTION */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm relative">
          
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="text-left px-5 py-3.5">Dispatch & D-Note #</th>
                  <th className="text-left px-5 py-3.5">Type & Destination</th>
                  <th className="text-left px-5 py-3.5">Transporter, Driver & Truck</th>
                  <th className="text-left px-5 py-3.5">Weight (kg)</th>
                  <th className="text-left px-5 py-3.5">Approval Status</th>
                  <th className="text-right px-5 py-3.5">Actions & D-Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => {
                  const meta = STATUS_META[o.status] || STATUS_META.pending;
                  const Icon = meta.icon;
                  const flow = nextStatus(o.status);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black font-mono text-xs border border-slate-700">
                            {o.dispatch_number.split('-').pop()?.slice(0, 3)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 font-mono">{o.dispatch_number}</p>
                              {o.physical_dnote_number && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-mono">
                                  #{o.physical_dnote_number}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">{format(new Date(o.dispatch_date), 'dd MMM yyyy')}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              o.dispatch_type === 'customer_direct' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            }`}>
                              {o.dispatch_type === 'customer_direct' ? 'Customer Direct' : 'Branch Transfer'}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800">
                            {o.dispatch_type === 'customer_direct' 
                              ? (o.customer_name || 'Direct Customer') 
                              : ((o.branches as any)?.name || '-')}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            {o.vehicle_number || 'Unassigned'}
                            {o.is_hired_truck && (
                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                                HIRED: {o.transporter_name || 'Third Party'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {o.driver_name || 'No driver'} {o.driver_phone ? `(${o.driver_phone})` : ''}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-extrabold text-slate-900 font-mono text-sm">{o.total_weight.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 ml-1">kg</span>
                        <p className="text-[10px] text-slate-400">({(o.total_weight / 1000).toFixed(2)} t)</p>
                      </td>

                      <td className="px-5 py-3.5 space-y-1">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                        </div>

                        {/* Branch Confirmation Status */}
                        {o.dispatch_type === 'branch_transfer' && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-slate-400">Branch:</span>
                            <span className={`font-bold ${o.branch_confirmation_status === 'confirmed' ? 'text-emerald-700' : 'text-amber-600'}`}>
                              {o.branch_confirmation_status === 'confirmed' ? '✓ Received' : 'Awaiting Receipt'}
                            </span>
                          </div>
                        )}

                        {/* Accounts Approval Status */}
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-slate-400">Accounts:</span>
                          <span className={`font-bold ${o.accounts_posting_status === 'approved' ? 'text-emerald-700' : 'text-blue-600'}`}>
                            {o.accounts_posting_status === 'approved' ? '✓ Posted / Invoiced' : 'Pending Posting'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Official D-Note Button */}
                          <button
                            onClick={() => openDNoteModal(o)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-900 text-white hover:bg-blue-950 font-bold text-[11px] shadow-sm transition-colors"
                            title="Official Delivery Note"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            D-Note
                          </button>

                          {/* Branch Confirm Button */}
                          {o.dispatch_type === 'branch_transfer' && o.branch_confirmation_status !== 'confirmed' && (o.status === 'in_transit' || o.status === 'dispatched' || o.status === 'delivered') && (
                            <button
                              onClick={() => { setBranchConfirmOrder(o); setBranchNotes(o.branch_confirmation_notes || ''); setShowBranchConfirmModal(true); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 font-bold text-[11px]"
                              title="Branch Delivery Confirmation"
                            >
                              <Check className="w-3 h-3 text-emerald-700" /> Confirm Branch
                            </button>
                          )}

                          {/* Accounts Approve Posting Button */}
                          {o.accounts_posting_status !== 'approved' && (
                            <button
                              onClick={() => { setAccountsApproveOrder(o); setAccountsNotes(o.accounts_approval_notes || ''); setShowAccountsApproveModal(true); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300 font-bold text-[11px]"
                              title="Accounts Approve & Post"
                            >
                              <DollarSign className="w-3 h-3 text-purple-700" /> Post / Invoice
                            </button>
                          )}

                          {flow && (
                            <button
                              onClick={() => updateStatus(o.id, flow.next)}
                              className="p-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all"
                              title={flow.label}
                            >
                              <flow.icon className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => openView(o)}
                            className="p-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                            title="View Dispatch Timeline"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

      </div>

      {/* CREATE / EDIT DISPATCH MODAL */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-5xl w-[98vw] h-[92vh] max-h-[92vh] p-0 sm:!max-w-5xl flex flex-col border-0 shadow-2xl rounded-3xl overflow-hidden [&>button.absolute]:hidden">
          
          {/* Header Banner */}
          <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">
                    {editingOrderId ? `Edit Dispatch Order (${dispatchNumber})` : 'New Dispatch Logistics Order'}
                  </h2>
                  <p className="text-slate-300 text-xs">Assign Driver, Hired Transporter, Vehicle & Generate D-Note</p>
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
            
            {/* DISPATCH DESTINATION TYPE SELECTOR */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
                1. Select Dispatch Type & Destination
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, dispatch_type: 'branch_transfer' })}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    form.dispatch_type === 'branch_transfer'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    form.dispatch_type === 'branch_transfer' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs">Branch Transfer (IBT)</p>
                    <p className="text-[10px] text-slate-500">Inter-branch inventory transfer requiring receiving confirmation</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, dispatch_type: 'customer_direct' })}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    form.dispatch_type === 'customer_direct'
                      ? 'bg-amber-50/80 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    form.dispatch_type === 'customer_direct' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs">Customer Direct Sales</p>
                    <p className="text-[10px] text-slate-500">Direct delivery to client; D-Note triggers Accounts Customer Invoice</p>
                  </div>
                </button>
              </div>

              {/* Destination inputs based on type */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                {form.dispatch_type === 'branch_transfer' ? (
                  <div className="space-y-1 md:col-span-2">
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
                ) : (
                  <>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">Customer Name *</label>
                      <input
                        type="text"
                        value={form.customer_name}
                        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                        placeholder="e.g. Farmer Direct Ltd"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 uppercase">Customer Code</label>
                      <input
                        type="text"
                        value={form.customer_code}
                        onChange={(e) => setForm({ ...form, customer_code: e.target.value })}
                        placeholder="e.g. CUST-091"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white"
                      />
                    </div>
                  </>
                )}

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
            </div>

            {/* DRIVER, TRUCK & HIRED TRANSPORTER LOGISTICS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Transporter, Driver & Truck Info</h3>
                </div>

                {/* Hired Truck Toggle */}
                <label className="inline-flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 text-amber-900 font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={form.is_hired_truck}
                    onChange={(e) => setForm({ ...form, is_hired_truck: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  Hired / Third-Party Truck?
                </label>
              </div>

              {form.is_hired_truck && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2">
                  <span className="font-extrabold text-amber-800 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-700" /> Hired Transporter Details
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase">Transporter Company Name *</label>
                      <input
                        type="text"
                        value={form.transporter_name}
                        onChange={(e) => setForm({ ...form, transporter_name: e.target.value })}
                        placeholder="e.g. Swift Freight Logistics / Bolloré"
                        className="w-full border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase">Driver Contact / Phone</label>
                      <input
                        type="text"
                        value={form.driver_phone}
                        onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
                        placeholder="e.g. +263 77 123 4567"
                        className="w-full border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Vehicle Reg Number *</label>
                  <input
                    type="text"
                    list="truck-list"
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                    placeholder="e.g. ABG 1234"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  />
                  <datalist id="truck-list">
                    {FLEET_TRUCKS.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Trailer Reg Number</label>
                  <input
                    type="text"
                    value={form.trailer_number}
                    onChange={(e) => setForm({ ...form, trailer_number: e.target.value })}
                    placeholder="e.g. TR-9021"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Driver Name *</label>
                  <input
                    type="text"
                    list="driver-list"
                    value={form.driver_name}
                    onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                    placeholder="e.g. P. Tembo / S. Mujele"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  />
                  <datalist id="driver-list">
                    {FLEET_DRIVERS.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Physical D-Note Serial # (Book)</label>
                  <input
                    type="text"
                    value={form.physical_dnote_number}
                    onChange={(e) => setForm({ ...form, physical_dnote_number: e.target.value })}
                    placeholder="e.g. 35877"
                    className="w-full border border-rose-300 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 font-mono bg-rose-50/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">HFDN Ref Number</label>
                  <input
                    type="text"
                    value={form.hfdn_reference}
                    onChange={(e) => setForm({ ...form, hfdn_reference: e.target.value })}
                    placeholder="e.g. 16+0947.5"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Order / Invoice Ref</label>
                  <input
                    type="text"
                    value={form.order_number}
                    onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                    placeholder="e.g. ORD-2026-90"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Delivery Notes / Remarks</label>
                  <input
                    value={form.delivery_notes}
                    onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                    placeholder="Special instructions..."
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">3. Dispatch Products & Quantities</h3>
                </div>
                <button
                  type="button"
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
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase">Qty</label>
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
                        <option value="bags">bags</option>
                        <option value="kg">kg</option>
                        <option value="tons">tons</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Total Weight: <strong className="text-emerald-700 font-mono text-sm">{totalWeight.toLocaleString()} kg</strong></span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || (form.dispatch_type === 'branch_transfer' && !form.branch_id) || (form.dispatch_type === 'customer_direct' && !form.customer_name)}
                className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                {saving ? 'Saving...' : editingOrderId ? 'Update Dispatch' : 'Save & Generate D-Note'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW DETAIL MODAL */}
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
                        {viewOrder.physical_dnote_number && (
                          <span className="bg-rose-500/20 text-rose-300 text-xs font-extrabold px-2 py-0.5 rounded border border-rose-500/30 font-mono">
                            D-Note Book #{viewOrder.physical_dnote_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Date: {format(new Date(viewOrder.dispatch_date), 'dd MMM yyyy')} • Driver: {viewOrder.driver_name || 'N/A'} • Vehicle: {viewOrder.vehicle_number || 'N/A'}
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
                
                {/* Action Bar with Official D-Note Printer */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDNoteModal(viewOrder)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-900 text-white hover:bg-blue-950 shadow-md"
                    >
                      <FileText className="w-4 h-4 text-amber-400" /> Print Official D-Note
                    </button>

                    {viewOrder.dispatch_type === 'branch_transfer' && viewOrder.branch_confirmation_status !== 'confirmed' && (
                      <button
                        onClick={() => { setBranchConfirmOrder(viewOrder); setBranchNotes(viewOrder.branch_confirmation_notes || ''); setShowBranchConfirmModal(true); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                      >
                        <Check className="w-4 h-4 text-emerald-700" /> Confirm Branch Receipt
                      </button>
                    )}

                    {viewOrder.accounts_posting_status !== 'approved' && (
                      <button
                        onClick={() => { setAccountsApproveOrder(viewOrder); setAccountsNotes(viewOrder.accounts_approval_notes || ''); setShowAccountsApproveModal(true); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300"
                      >
                        <DollarSign className="w-4 h-4 text-purple-700" /> Accounts Approve Posting
                      </button>
                    )}
                  </div>

                  {nextStatus(viewOrder.status) && (
                    <button
                      onClick={() => updateStatus(viewOrder.id, nextStatus(viewOrder.status)!.next)}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Advance to {nextStatus(viewOrder.status)!.label}
                    </button>
                  )}
                </div>

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
                          <th className="text-right px-4 py-2.5">Quantity</th>
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

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* OFFICIAL D-NOTE PRINTABLE MODAL */}
      <DeliveryNoteModal
        isOpen={showDNote}
        onClose={() => setShowDNote(false)}
        order={dnoteOrder}
        items={dnoteItems}
      />

      {/* BRANCH CONFIRM DELIVERY MODAL */}
      <Dialog open={showBranchConfirmModal} onOpenChange={setShowBranchConfirmModal}>
        <DialogContent className="max-w-md w-full p-6 bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Confirm Branch Delivery</h3>
                <p className="text-xs text-slate-500">Verify stock delivery at receiving branch</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Confirm that dispatch <strong className="font-mono text-slate-900">{branchConfirmOrder?.dispatch_number}</strong> was received in full and in good order at the receiving branch.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase">Receiving Inspection Notes</label>
              <textarea
                value={branchNotes}
                onChange={(e) => setBranchNotes(e.target.value)}
                placeholder="e.g. All 300 bags received intact. No seal tampering or moisture damage."
                rows={3}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBranchConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBranchDelivery}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
              >
                {saving ? 'Confirming...' : 'Confirm Delivery Received'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ACCOUNTS APPROVE POSTING MODAL */}
      <Dialog open={showAccountsApproveModal} onOpenChange={setShowAccountsApproveModal}>
        <DialogContent className="max-w-md w-full p-6 bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-purple-100 rounded-xl text-purple-800">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Accounts Approve & Post</h3>
                <p className="text-xs text-slate-500">Raise Customer Invoice or Approve Sage Stock Transfer</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Approving dispatch <strong className="font-mono text-slate-900">{accountsApproveOrder?.dispatch_number}</strong> for {accountsApproveOrder?.dispatch_type === 'customer_direct' ? 'Direct Customer Invoicing' : 'Sage IBT Stock Posting'}.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase">Finance Approval Remarks</label>
              <textarea
                value={accountsNotes}
                onChange={(e) => setAccountsNotes(e.target.value)}
                placeholder="e.g. Verified against D-Note #35877. Approved for posting."
                rows={3}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAccountsApproveModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccountsApprovePosting}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-md"
              >
                {saving ? 'Approving...' : 'Approve & Post to System'}
              </button>
            </div>
          </div>
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
    </div>
  );
}
