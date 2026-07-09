import { useState, useEffect } from 'react';
import { Plus, Search, Factory, Calendar, Eye, CheckCircle, ArrowRight, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent } from '../components/ui/dialog';
import StatusBadge from '../components/ui/StatusBadge';
import MaterialTransferApprovalButtons from '../components/approval/MaterialTransferApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import StockTakeFrozenBanner from '../components/stock/StockTakeFrozenBanner';

interface MaterialTransfer {
  id: string;
  transfer_number: string;
  raw_material_id: string;
  from_warehouse_id: string;
  to_location: string;
  quantity: number;
  unit: string;
  transfer_date: string;
  requested_by: string;
  approved_by?: string;
  buffer_approved_by?: string;
  buffer_approved_at?: string;
  production_approved_by?: string;
  production_approved_at?: string;
  status: 'pending' | 'in_buffer' | 'approved' | 'in_transit' | 'received' | 'rejected';
  purpose: string;
  production_order_id?: string;
  notes: string;
  rejection_reason?: string;
  created_at: string;
  raw_materials?: { name: string; code: string; unit: string };
  warehouses?: { name: string };
}

export default function MaterialTransferPage() {
  const [transfers, setTransfers] = useState<MaterialTransfer[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [rmWarehouseBalances, setRmWarehouseBalances] = useState<Record<string, number>>({});
  const [bufferWarehouseBalances, setBufferWarehouseBalances] = useState<Record<string, number>>({});
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
  const [availableLots, setAvailableLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<MaterialTransfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const [form, setForm] = useState({
    raw_material_id: '',
    from_warehouse_id: '',
    to_location: 'Production Floor',
    quantity: 0,
    transfer_date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
    production_order_id: '',
    source_lot_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Default from warehouse to Raw Materials Warehouse (code 'RM')
  useEffect(() => {
    const rmWarehouse = warehouses.find((w) => w.code === 'RM');
    if (rmWarehouse && !form.from_warehouse_id) {
      setForm((f) => ({ ...f, from_warehouse_id: rmWarehouse.id }));
    }
  }, [warehouses]);

  // Load available lots (FIFO order) whenever the selected raw material changes
  useEffect(() => {
    async function loadLots() {
      if (!form.raw_material_id) { setAvailableLots([]); return; }
      const { data, error } = await supabase
        .from('v_rm_available_lots')
        .select('lot_id, batch_number, qty_remaining, unit, received_date, grn_number, source')
        .eq('raw_material_id', form.raw_material_id);
      if (error) { console.error('Failed to load lots:', error); setAvailableLots([]); return; }
      setAvailableLots(data || []);
    }
    loadLots();
    // Clear any previously selected lot when material changes
    setForm(f => ({ ...f, source_lot_id: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.raw_material_id]);

  async function fetchData() {
    setLoading(true);
    const [transfersRes, materialsRes, warehousesRes, ordersRes, rmBalancesRes, bufferBalancesRes] = await Promise.all([
      supabase
        .from('material_transfers')
        .select('*, raw_materials(name, code, unit), warehouses:from_warehouse_id(name)')
        .order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*').eq('is_active', true).order('name'),
      supabase
        .from('production_orders')
        .select('id, batch_number, status')
        .in('status', ['pending', 'materials_issued', 'in_progress'])
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_stock_balances')
        .select('raw_material_id, quantity, warehouses!inner(code)')
        .eq('warehouses.code', 'RM'),
      supabase
        .from('warehouse_stock_balances')
        .select('raw_material_id, quantity, warehouses!inner(code)')
        .eq('warehouses.code', 'BUFFER'),
    ]);

    if (transfersRes.data) {
      setTransfers(transfersRes.data as any);
    }
    if (materialsRes.data) setRawMaterials(materialsRes.data);
    if (warehousesRes.data) setWarehouses(warehousesRes.data);
    if (ordersRes.data) setProductionOrders(ordersRes.data);
    if (rmBalancesRes.data) {
      const balances: Record<string, number> = {};
      rmBalancesRes.data.forEach((b: any) => {
        balances[b.raw_material_id] = Number(b.quantity || 0);
      });
      setRmWarehouseBalances(balances);
    }
    if (bufferBalancesRes.data) {
      const balances: Record<string, number> = {};
      bufferBalancesRes.data.forEach((b: any) => {
        balances[b.raw_material_id] = Number(b.quantity || 0);
      });
      setBufferWarehouseBalances(balances);
    }
    setLoading(false);
  }

  async function createTransfer() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        alert('User not authenticated');
        setSaving(false);
        return;
      }

      // Find RM warehouse and Buffer warehouse
      const rmWarehouse = warehouses.find((w) => w.code === 'RM');
      const bufferWarehouse = warehouses.find((w) => w.code === 'BUFFER');
      const fromWarehouseId = rmWarehouse?.id || form.from_warehouse_id;

      if (!fromWarehouseId) {
        alert('Raw Materials Warehouse not found. Please contact admin.');
        setSaving(false);
        return;
      }
      if (!bufferWarehouse) {
        alert('Buffer Warehouse not found. Please run the migration.');
        setSaving(false);
        return;
      }

      // Check RM warehouse balance
      const rmBalance = rmWarehouseBalances[form.raw_material_id] || 0;
      if (form.quantity > rmBalance) {
        alert(`Insufficient stock in Raw Materials Warehouse. Available: ${rmBalance.toLocaleString()} kg, Requested: ${form.quantity.toLocaleString()} kg`);
        setSaving(false);
        return;
      }

      // Create the transfer in in_buffer status (already moved to buffer)
      const { data: transferData, error: insertError } = await supabase
        .from('material_transfers')
        .insert({
          raw_material_id: form.raw_material_id,
          from_warehouse_id: fromWarehouseId,
          to_location: 'Production Floor',
          buffer_warehouse_id: bufferWarehouse.id,
          quantity: form.quantity,
          unit: rawMaterials.find(m => m.id === form.raw_material_id)?.unit || 'kg',
          transfer_date: form.transfer_date,
          purpose: form.purpose,
          production_order_id: form.production_order_id || null,
          notes: form.notes,
          status: 'in_buffer',
          buffer_approved_by: user.id,
          buffer_approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating transfer:', insertError);
        alert(`Failed to create transfer: ${insertError.message}`);
        setSaving(false);
        return;
      }

      // Move stock from RM Warehouse to Buffer Warehouse automatically
      await supabase.rpc('update_warehouse_balance', {
        p_raw_material_id: form.raw_material_id,
        p_warehouse_id: fromWarehouseId,
        p_quantity_delta: -form.quantity
      });

      await supabase.rpc('update_warehouse_balance', {
        p_raw_material_id: form.raw_material_id,
        p_warehouse_id: bufferWarehouse.id,
        p_quantity_delta: form.quantity
      });

      // Record stock movements
      await supabase.from('stock_movements').insert({
        raw_material_id: form.raw_material_id,
        movement_type: 'transfer',
        quantity: -form.quantity,
        warehouse_id: fromWarehouseId,
        reference_type: 'material_transfer',
        reference_id: transferData.id,
        notes: 'Auto-transfer: RM Warehouse → Buffer Warehouse on creation',
        performed_by: user.id,
      });

      await supabase.from('stock_movements').insert({
        raw_material_id: form.raw_material_id,
        movement_type: 'transfer',
        quantity: form.quantity,
        warehouse_id: bufferWarehouse.id,
        reference_type: 'material_transfer',
        reference_id: transferData.id,
        notes: 'Auto-transfer: Buffer Warehouse receipt on creation',
        performed_by: user.id,
      });

      setShowCreate(false);
      setForm({
        raw_material_id: '',
        from_warehouse_id: '',
        to_location: 'Production Floor',
        quantity: 0,
        transfer_date: format(new Date(), 'yyyy-MM-dd'),
        purpose: '',
        production_order_id: '',
        source_lot_id: '',
        notes: '',
      });
      setSuccessMessage('Transfer created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchData();
    } catch (err: any) {
      console.error('Unexpected error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }


  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      !searchTerm ||
      transfer.raw_materials?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.raw_materials?.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.to_location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: transfers.length,
    in_buffer: transfers.filter(t => t.status === 'in_buffer').length,
    received: transfers.filter(t => t.status === 'received').length,
    rejected: transfers.filter(t => t.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <StockTakeFrozenBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Material Transfer</h1>
          <p className="text-sm text-slate-500 mt-1">Transfer raw materials from warehouse to production</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Factory className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In Buffer</p>
            <p className="mt-0.5 text-xl font-bold text-amber-900">{statusCounts.in_buffer}</p>
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Received</p>
            <p className="mt-0.5 text-xl font-bold text-green-900">{statusCounts.received}</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Rejected</p>
            <p className="mt-0.5 text-xl font-bold text-red-900">{statusCounts.rejected}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-800">Material Transfers</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by material name, code, or destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="all">All Status ({statusCounts.all})</option>
              <option value="in_buffer">In Buffer ({statusCounts.in_buffer})</option>
              <option value="received">Received ({statusCounts.received})</option>
              <option value="rejected">Rejected ({statusCounts.rejected})</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                {['Date', 'Material', 'From Warehouse', 'To Location', 'Quantity', 'RM Balance', 'Buffer Balance', 'Purpose', 'Status', 'Actions'].map((header) => (
                  <th key={header} className={`px-3 py-2 font-semibold text-slate-600 text-xs ${['Quantity', 'RM Balance', 'Buffer Balance'].includes(header) ? 'text-right' : 'text-left'}`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No material transfers found
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer) => {
                  const transferDate = transfer.transfer_date || transfer.created_at;
                  const quantity = Math.abs(transfer.quantity || 0);
                  const rmBalance = rmWarehouseBalances[transfer.raw_material_id] ?? 0;
                  const bufferBalance = bufferWarehouseBalances[transfer.raw_material_id] ?? 0;
                  return (
                    <tr key={transfer.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setViewTransfer(transfer)}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {transferDate ? format(new Date(transferDate), 'dd MMM yyyy') : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{transfer.raw_materials?.name || '-'}</p>
                        <p className="text-xs text-slate-500">{transfer.raw_materials?.code || ''}</p>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-600">{transfer.warehouses?.name || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Factory className="w-3.5 h-3.5 text-slate-400" />
                          {transfer.to_location || 'Production Floor'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-slate-700">
                        {quantity.toLocaleString()} {transfer.unit || 'kg'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-slate-700">
                        {rmBalance.toLocaleString()} {transfer.unit || 'kg'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-emerald-700">
                        {bufferBalance.toLocaleString()} {transfer.unit || 'kg'}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-600">{transfer.purpose || '-'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={transfer.status || 'pending'} />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewTransfer(transfer); }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Transfer Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-4xl p-0">
          <div className="shrink-0 border-b bg-slate-900 text-white px-5 py-3 rounded-t-lg relative">
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">New Material Transfer</h2>
                  <p className="text-slate-400 text-xs">Transfer raw materials from warehouse to production</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                Draft
              </span>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <Eye className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4 bg-gradient-to-b from-slate-200/80 via-slate-100 to-slate-300/70">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-8 rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-slate-800">Transfer Details</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Core</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Raw Material *</label>
                    <select
                      value={form.raw_material_id}
                      onChange={(e) => setForm({ ...form, raw_material_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      required
                    >
                      <option value="">Select material</option>
                      {rawMaterials.map((material) => {
                        const rmBalance = rmWarehouseBalances[material.id] ?? 0;
                        return (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.code}) - RM Stock: {rmBalance.toLocaleString()} {material.unit}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Quantity *</label>
                    <input
                      type="number"
                      value={form.quantity || ''}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Transfer Date *</label>
                    <input
                      type="date"
                      value={form.transfer_date}
                      onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Purpose *</label>
                    <input
                      type="text"
                      value={form.purpose}
                      onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      placeholder="e.g., For Batch BATCH-2026-123"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="xl:col-span-4 rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-800">Transfer Route</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">Auto</span>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500 mb-1">From Warehouse</p>
                    <p className="text-sm font-semibold text-slate-800">Raw Materials Warehouse</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500 mb-1">To Location</p>
                    <p className="text-sm font-semibold text-slate-800">Production Floor (via Buffer)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white shadow-sm p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-2">
                  <Factory className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Additional Details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    Source Batch / GRN Lot {availableLots.length > 0 && <span className="text-[10px] text-slate-400">(FIFO — oldest first)</span>}
                  </label>
                  <select
                    value={form.source_lot_id}
                    onChange={(e) => {
                      const lot = availableLots.find(l => l.lot_id === e.target.value);
                      setForm({
                        ...form,
                        source_lot_id: e.target.value,
                        quantity: lot ? Math.min(form.quantity || lot.qty_remaining, lot.qty_remaining) : form.quantity,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    disabled={!form.raw_material_id}
                  >
                    <option value="">
                      {!form.raw_material_id ? 'Select a raw material first' : availableLots.length === 0 ? 'No available lots — check GRN approvals' : 'Select source batch (optional)'}
                    </option>
                    {availableLots.map((lot) => (
                      <option key={lot.lot_id} value={lot.lot_id}>
                        {lot.batch_number} · {Number(lot.qty_remaining).toLocaleString()} {lot.unit} available {lot.grn_number ? `· GRN ${lot.grn_number}` : lot.source === 'opening_balance' ? '· Opening' : ''} · {new Date(lot.received_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  {form.source_lot_id && (() => {
                    const lot = availableLots.find(l => l.lot_id === form.source_lot_id);
                    if (!lot) return null;
                    const over = form.quantity > Number(lot.qty_remaining);
                    return (
                      <p className={`text-[11px] mt-1 ${over ? 'text-red-600' : 'text-slate-500'}`}>
                        {over
                          ? `⚠ Transfer quantity exceeds lot balance (${Number(lot.qty_remaining).toLocaleString()} ${lot.unit}).`
                          : `Lot balance: ${Number(lot.qty_remaining).toLocaleString()} ${lot.unit}.`}
                      </p>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Production Order (Optional)</label>
                  <select
                    value={form.production_order_id}
                    onChange={(e) => setForm({ ...form, production_order_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select order (optional)</option>
                    {productionOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.batch_number} - {order.status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={createTransfer}
                disabled={
                  saving ||
                  !form.raw_material_id ||
                  !form.from_warehouse_id ||
                  !form.quantity ||
                  !form.purpose ||
                  (form.quantity > (rmWarehouseBalances[form.raw_material_id] || 0))
                }
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center text-sm font-medium"
              >
                {saving ? 'Creating...' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 z-50">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      )}

      {/* View Transfer Modal */}
      <Dialog open={viewTransfer !== null} onOpenChange={() => setViewTransfer(null)}>
        <DialogContent className="max-w-4xl p-0">
          <div className="shrink-0 border-b bg-slate-900 text-white px-5 py-3 rounded-t-lg relative">
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Transfer Details</h2>
                  <p className="text-slate-400 text-xs">View material transfer information</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                {viewTransfer?.status || 'pending'}
              </span>
            </div>
            <button
              onClick={() => setViewTransfer(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <Eye className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4 bg-gradient-to-b from-slate-200/80 via-slate-100 to-slate-300/70">
            {viewTransfer && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Material</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{viewTransfer.raw_materials?.name || '-'}</p>
                    <p className="text-xs text-slate-500">{viewTransfer.raw_materials?.code || ''}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quantity</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {Math.abs(viewTransfer.quantity || 0).toLocaleString()} {viewTransfer.unit || 'kg'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={viewTransfer.status || 'pending'} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <ArrowRight className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-semibold text-slate-800">Transfer Route</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">From Warehouse</label>
                      <p className="text-sm text-slate-800">{viewTransfer.warehouses?.name || '-'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">To Location</label>
                      <p className="text-sm text-slate-800">{viewTransfer.to_location || 'Production Floor'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Transfer Date</label>
                      <p className="text-sm text-slate-800">
                        {viewTransfer.transfer_date || viewTransfer.created_at ? format(new Date(viewTransfer.transfer_date || viewTransfer.created_at), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Purpose</label>
                      <p className="text-sm text-slate-800">{viewTransfer.purpose || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Factory className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-slate-800">Additional Information</h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Notes</label>
                    <p className="text-sm text-slate-800">{viewTransfer.notes || 'No additional notes'}</p>
                  </div>
                  {viewTransfer.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-700">{viewTransfer.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {viewTransfer.status === 'in_buffer' && (
                  <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white shadow-sm p-3">
                    <MaterialTransferApprovalButtons
                      transferId={viewTransfer.id}
                      currentStatus={viewTransfer.status}
                      quantity={viewTransfer.quantity}
                      rawMaterialId={viewTransfer.raw_material_id}
                      fromWarehouseId={viewTransfer.from_warehouse_id}
                      onApproved={() => {
                        fetchData();
                        setViewTransfer(null);
                      }}
                      onRejected={() => {
                        fetchData();
                        setViewTransfer(null);
                      }}
                    />
                  </div>
                )}

                <div className="rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-800">Approval History</h3>
                  </div>
                  <ApprovalHistory entityType="material_transfer" entityId={viewTransfer.id} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setViewTransfer(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
