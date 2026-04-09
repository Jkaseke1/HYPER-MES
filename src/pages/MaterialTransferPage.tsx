import { useState, useEffect } from 'react';
import { Plus, Search, Factory, Calendar, Eye, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ApprovalButtons from '../components/approval/ApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';

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
  status: 'pending' | 'approved' | 'in_transit' | 'received' | 'rejected';
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
  const [productionOrders, setProductionOrders] = useState<any[]>([]);
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
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [transfersRes, materialsRes, warehousesRes, ordersRes] = await Promise.all([
      supabase
        .from('stock_movements')
        .select('*, raw_materials(name, code, unit), warehouses(name)')
        .eq('movement_type', 'transfer')
        .order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*').eq('is_active', true).order('name'),
      supabase
        .from('production_orders')
        .select('id, batch_number, status')
        .in('status', ['pending', 'materials_issued', 'in_progress'])
        .order('created_at', { ascending: false }),
    ]);

    if (transfersRes.data) {
      // Ensure all transfers have a status field (for backward compatibility)
      const transfersWithStatus = transfersRes.data.map((t: any) => ({
        ...t,
        status: t.status || 'pending'
      }));
      setTransfers(transfersWithStatus as any);
    }
    if (materialsRes.data) setRawMaterials(materialsRes.data);
    if (warehousesRes.data) setWarehouses(warehousesRes.data);
    if (ordersRes.data) setProductionOrders(ordersRes.data);
    setLoading(false);
  }

  async function createTransfer() {
    setSaving(true);
    try {
      const { error } = await supabase.from('stock_movements').insert({
        movement_type: 'transfer',
        raw_material_id: form.raw_material_id,
        warehouse_id: form.from_warehouse_id,
        quantity: -Math.abs(form.quantity), // Negative for outbound
        unit: rawMaterials.find(m => m.id === form.raw_material_id)?.unit || 'kg',
        movement_date: form.transfer_date,
        notes: `Transfer to ${form.to_location}. Purpose: ${form.purpose}. ${form.notes}`,
      });

      if (error) {
        console.error('Error creating transfer:', error);
        alert(`Failed to create transfer: ${error.message}`);
        setSaving(false);
        return;
      }

      setShowCreate(false);
      setForm({
        raw_material_id: '',
        from_warehouse_id: '',
        to_location: 'Production Floor',
        quantity: 0,
        transfer_date: format(new Date(), 'yyyy-MM-dd'),
        purpose: '',
        production_order_id: '',
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
    pending: transfers.filter(t => t.status === 'pending').length,
    approved: transfers.filter(t => t.status === 'approved').length,
    received: transfers.filter(t => t.status === 'received').length,
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by material name, code, or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white min-w-[180px]"
        >
          <option value="all">All Status ({statusCounts.all})</option>
          <option value="pending">Pending ({statusCounts.pending})</option>
          <option value="approved">Approved ({statusCounts.approved})</option>
          <option value="received">Received ({statusCounts.received})</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Date', 'Material', 'From Warehouse', 'To Location', 'Quantity', 'Purpose', 'Status', 'Actions'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-slate-600">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No material transfers found
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer) => {
                  const transferDate = transfer.transfer_date || transfer.created_at;
                  const quantity = Math.abs(transfer.quantity || 0);
                  return (
                    <tr key={transfer.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setViewTransfer(transfer)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {transferDate ? format(new Date(transferDate), 'dd MMM yyyy') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">{transfer.raw_materials?.name || '-'}</p>
                        <p className="text-xs text-slate-500">{transfer.raw_materials?.code || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{transfer.warehouses?.name || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Factory className="w-3.5 h-3.5 text-slate-400" />
                          {transfer.to_location || 'Production Floor'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-slate-700">
                        {quantity.toLocaleString()} {transfer.unit || 'kg'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{transfer.purpose || '-'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={transfer.status || 'pending'} />
                      </td>
                      <td className="px-4 py-3">
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
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Material Transfer"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Raw Material *</label>
              <select
                value={form.raw_material_id}
                onChange={(e) => setForm({ ...form, raw_material_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                required
              >
                <option value="">Select material</option>
                {rawMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name} ({material.code}) - Stock: {material.current_stock} {material.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From Warehouse *</label>
              <select
                value={form.from_warehouse_id}
                onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To Location *</label>
              <select
                value={form.to_location}
                onChange={(e) => setForm({ ...form, to_location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="Production Floor">Production Floor</option>
                <option value="Mixing Area">Mixing Area</option>
                <option value="Packaging Line">Packaging Line</option>
                <option value="Quality Lab">Quality Lab</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                value={form.quantity || ''}
                onChange={(e) => setForm({ ...form, quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Transfer Date *</label>
              <input
                type="date"
                value={form.transfer_date}
                onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Production Order (Optional)</label>
              <select
                value={form.production_order_id}
                onChange={(e) => setForm({ ...form, production_order_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose *</label>
            <input
              type="text"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              placeholder="e.g., For Batch BATCH-2026-123"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createTransfer}
              disabled={saving || !form.raw_material_id || !form.from_warehouse_id || !form.quantity || !form.purpose}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Transfer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 z-50">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      )}

      {/* View Transfer Modal */}
      <Modal
        open={viewTransfer !== null}
        onClose={() => setViewTransfer(null)}
        title="Transfer Details"
      >
        {viewTransfer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Material</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{viewTransfer.raw_materials?.name || '-'}</p>
                <p className="text-xs text-slate-500">{viewTransfer.raw_materials?.code || ''}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Quantity</label>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {Math.abs(viewTransfer.quantity || 0).toLocaleString()} {viewTransfer.unit || 'kg'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">From</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{viewTransfer.warehouses?.name || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">To</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{viewTransfer.to_location || 'Production Floor'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Transfer Date</label>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {viewTransfer.transfer_date || viewTransfer.created_at ? format(new Date(viewTransfer.transfer_date || viewTransfer.created_at), 'dd MMM yyyy') : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                <div className="mt-1">
                  <StatusBadge status={viewTransfer.status || 'pending'} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Purpose</label>
              <p className="text-sm text-slate-700 mt-1">{viewTransfer.purpose || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Notes</label>
              <p className="text-sm text-slate-700 mt-1">{viewTransfer.notes || 'No additional notes'}</p>
            </div>
            {viewTransfer.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{viewTransfer.rejection_reason}</p>
              </div>
            )}

            {viewTransfer.status === 'pending' && (
              <div className="border-t border-slate-200 pt-4">
                <ApprovalButtons
                  entityType="material_transfer"
                  entityId={viewTransfer.id}
                  currentStatus={viewTransfer.status}
                  approveStatus="approved"
                  rejectStatus="rejected"
                  onApproved={() => {
                    setViewTransfer(null);
                    fetchData();
                  }}
                  onRejected={() => {
                    setViewTransfer(null);
                    fetchData();
                  }}
                />
              </div>
            )}

            <div className="border-t border-slate-200 pt-4">
              <ApprovalHistory entityType="material_transfer" entityId={viewTransfer.id} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setViewTransfer(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
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
