import { useState, useEffect } from 'react';
import { Plus, Search, Factory, Calendar, Eye, CheckCircle, ArrowRight, Package, Truck, Trash2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<MaterialTransfer | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Multi-line transfer state
  const [transferLines, setTransferLines] = useState<Array<{
    id: string;
    raw_material_id: string;
    quantity: number;
    source_lot_id: string;
  }>>([{ id: crypto.randomUUID(), raw_material_id: '', quantity: 0, source_lot_id: '' }]);

  const [sharedForm, setSharedForm] = useState({
    transfer_date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
    production_order_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('material-transfer-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_transfers' }, () => {
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock_balances' }, () => {
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
        fetchData(true);
      })
      .subscribe();

    const intervalId = window.setInterval(() => {
      fetchData(true);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  const addTransferLine = () => {
    setTransferLines([...transferLines, { id: crypto.randomUUID(), raw_material_id: '', quantity: 0, source_lot_id: '' }]);
  };

  const removeTransferLine = (id: string) => {
    if (transferLines.length === 1) return;
    setTransferLines(transferLines.filter(line => line.id !== id));
  };

  const updateTransferLine = (id: string, field: string, value: any) => {
    setTransferLines(transferLines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
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
    if (!silent) setLoading(false);
  }

  async function createTransfers() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        alert('User not authenticated');
        setSaving(false);
        return;
      }

      const rmWarehouse = warehouses.find((w) => w.code === 'RM');
      const fromWarehouseId = rmWarehouse?.id;

      if (!fromWarehouseId) {
        alert('Raw Materials Warehouse not found. Please contact admin.');
        setSaving(false);
        return;
      }

      // Validate all lines
      const validLines = transferLines.filter(line => line.raw_material_id && line.quantity > 0);
      if (validLines.length === 0) {
        alert('Please add at least one material with quantity > 0');
        setSaving(false);
        return;
      }

      // Check stock for all lines
      for (const line of validLines) {
        const rmBalance = rmWarehouseBalances[line.raw_material_id] || 0;
        const material = rawMaterials.find(m => m.id === line.raw_material_id);
        if (line.quantity > rmBalance) {
          alert(`Insufficient stock for ${material?.name || 'material'}. Available: ${rmBalance.toLocaleString()} kg, Requested: ${line.quantity.toLocaleString()} kg`);
          setSaving(false);
          return;
        }
      }

      // Create all transfers
      const errors: string[] = [];
      for (const line of validLines) {
        const material = rawMaterials.find(m => m.id === line.raw_material_id);
        const { error } = await supabase.rpc('create_material_transfer_to_buffer', {
          p_raw_material_id: line.raw_material_id,
          p_from_warehouse_id: fromWarehouseId,
          p_quantity: line.quantity,
          p_unit: material?.unit || 'kg',
          p_transfer_date: sharedForm.transfer_date,
          p_purpose: sharedForm.purpose,
          p_notes: sharedForm.notes || null,
          p_production_order_id: sharedForm.production_order_id || null,
          p_requested_by: user.id,
        });

        if (error) {
          errors.push(`${material?.name || line.raw_material_id}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        alert(`Some transfers failed:\n${errors.join('\n')}`);
        setSaving(false);
        return;
      }

      setShowCreate(false);
      setTransferLines([{ id: crypto.randomUUID(), raw_material_id: '', quantity: 0, source_lot_id: '' }]);
      setSharedForm({
        transfer_date: format(new Date(), 'yyyy-MM-dd'),
        purpose: '',
        production_order_id: '',
        notes: '',
      });
      setSuccessMessage(`${validLines.length} transfer(s) created successfully!`);
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
        <DialogContent className="w-[96vw] max-w-6xl p-0 max-h-[94vh] overflow-hidden">
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

          <div className="p-4 md:p-5 space-y-4 bg-gradient-to-b from-slate-200/80 via-slate-100 to-slate-300/70 overflow-y-auto max-h-[calc(94vh-72px)]">
            {/* Shared Header Fields */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-8 rounded-xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-slate-800">Shared Transfer Info</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">All Items</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Transfer Date *</label>
                    <input
                      type="date"
                      value={sharedForm.transfer_date}
                      onChange={(e) => setSharedForm({ ...sharedForm, transfer_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Purpose *</label>
                    <input
                      type="text"
                      value={sharedForm.purpose}
                      onChange={(e) => setSharedForm({ ...sharedForm, purpose: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      placeholder="e.g., For Batch BATCH-2026-123"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Production Order (Optional)</label>
                    <select
                      value={sharedForm.production_order_id}
                      onChange={(e) => setSharedForm({ ...sharedForm, production_order_id: e.target.value })}
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Notes</label>
                    <input
                      type="text"
                      value={sharedForm.notes}
                      onChange={(e) => setSharedForm({ ...sharedForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      placeholder="Additional notes..."
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

            {/* Transfer Line Items */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white shadow-sm p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Materials to Transfer</p>
                </div>
                <button
                  onClick={addTransferLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Material
                </button>
              </div>

              <div className="space-y-2">
                {transferLines.map((line, index) => {
                  const material = rawMaterials.find(m => m.id === line.raw_material_id);
                  const rmBalance = rmWarehouseBalances[line.raw_material_id] || 0;
                  const insufficient = line.quantity > rmBalance;
                  return (
                    <div key={line.id} className="grid grid-cols-12 gap-2 items-start p-2.5 rounded-lg border border-slate-200 bg-white">
                      <div className="col-span-1 flex items-center justify-center pt-2">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      </div>
                      <div className="col-span-6 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500">Raw Material *</label>
                        <select
                          value={line.raw_material_id}
                          onChange={(e) => updateTransferLine(line.id, 'raw_material_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        >
                          <option value="">Select material</option>
                          {rawMaterials.map((mat) => {
                            const bal = rmWarehouseBalances[mat.id] ?? 0;
                            return (
                              <option key={mat.id} value={mat.id}>
                                {mat.name} ({mat.code}) - Stock: {bal.toLocaleString()} {mat.unit}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500">Quantity *</label>
                        <input
                          type="number"
                          value={line.quantity || ''}
                          onChange={(e) => updateTransferLine(line.id, 'quantity', e.target.value ? parseFloat(e.target.value) : 0)}
                          className={`w-full px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            insufficient ? 'border-red-300 bg-red-50' : 'border-slate-200'
                          }`}
                          placeholder="0.00"
                          step="0.01"
                        />
                        {line.raw_material_id && insufficient && (
                          <p className="text-[10px] text-red-600 mt-0.5">⚠ Exceeds stock ({rmBalance.toLocaleString()} {material?.unit})</p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-end justify-end pt-5">
                        <button
                          onClick={() => removeTransferLine(line.id)}
                          disabled={transferLines.length === 1}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove line"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                onClick={createTransfers}
                disabled={
                  saving ||
                  !sharedForm.purpose ||
                  transferLines.filter(l => l.raw_material_id && l.quantity > 0).length === 0
                }
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center text-sm font-medium"
              >
                {saving ? 'Creating...' : `Create ${transferLines.filter(l => l.raw_material_id && l.quantity > 0).length} Transfer(s)`}
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
