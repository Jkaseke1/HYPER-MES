import { useState, useEffect, useCallback } from 'react';
import { Search, Check, X, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent } from '../components/ui/dialog';
import StatusBadge from '../components/ui/StatusBadge';

type Tab = 'pending' | 'approved' | 'rejected';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

interface BatchWithPriceApproval {
  id: string;
  batch_number: string;
  formulation_id: string;
  formulation_name: string;
  sage_code: string;
  actual_qty: number;
  completion_date: string;
  price_approval_status: string;
  price_approval_id: string | null;
  unit_price_usd: number;
  unit_price_zig: number;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  cost_per_unit: number;
}

export default function PriceControlPage() {
  const [batches, setBatches] = useState<BatchWithPriceApproval[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchWithPriceApproval | null>(null);
  const [form, setForm] = useState({ unit_price_usd: 0, unit_price_zig: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchBatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('completed_batches_pending_price_approval')
      .select('*')
      .order('completion_date', { ascending: false });

    if (error) {
      console.error('Error fetching batches:', error);
      return;
    }

    // Fetch production orders to get cost per unit
    const batchIds = data?.map(b => b.id) || [];
    const { data: productionOrders } = await supabase
      .from('production_orders')
      .select('id, cost_per_unit')
      .in('id', batchIds);

    const costMap = new Map(productionOrders?.map(po => [po.id, po.cost_per_unit]) || []);

    const enrichedData = (data || []).map(b => ({
      ...b,
      cost_per_unit: costMap.get(b.id) || 0,
    })) as BatchWithPriceApproval[];

    setBatches(enrichedData);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const openApproveModal = (batch: BatchWithPriceApproval) => {
    setSelectedBatch(batch);
    setForm({
      unit_price_usd: batch.unit_price_usd || 0,
      unit_price_zig: batch.unit_price_zig || 0,
      notes: batch.notes || '',
    });
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedBatch) return;
    setSaving(true);

    try {
      // Check if price approval already exists
      if (selectedBatch.price_approval_id) {
        // Update existing
        const { error } = await supabase
          .from('price_approvals')
          .update({
            unit_price_usd: form.unit_price_usd,
            unit_price_zig: form.unit_price_zig,
            status: 'approved',
            notes: form.notes,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', selectedBatch.price_approval_id);

        if (error) throw error;
      } else {
        // Create new
        const { data: approvalData, error: approvalError } = await supabase
          .from('price_approvals')
          .insert({
            batch_id: selectedBatch.id,
            formulation_id: selectedBatch.formulation_id,
            unit_price_usd: form.unit_price_usd,
            unit_price_zig: form.unit_price_zig,
            status: 'approved',
            notes: form.notes,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (approvalError) throw approvalError;

        // Update production batch
        const { error: batchError } = await supabase
          .from('production_batches')
          .update({
            price_approval_status: 'approved',
            price_approval_id: approvalData.id,
          })
          .eq('id', selectedBatch.id);

        if (batchError) throw batchError;
      }

      setShowApproveModal(false);
      fetchBatches();
    } catch (error) {
      console.error('Error approving price:', error);
      alert('Failed to approve price. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBatch) return;
    setSaving(true);

    try {
      if (selectedBatch.price_approval_id) {
        const { error } = await supabase
          .from('price_approvals')
          .update({
            status: 'rejected',
            notes: form.notes,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', selectedBatch.price_approval_id);

        if (error) throw error;
      } else {
        const { data: approvalData, error: approvalError } = await supabase
          .from('price_approvals')
          .insert({
            batch_id: selectedBatch.id,
            formulation_id: selectedBatch.formulation_id,
            unit_price_usd: 0,
            unit_price_zig: 0,
            status: 'rejected',
            notes: form.notes,
            approved_by: (await supabase.auth.getUser()).data.user?.id,
            approved_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (approvalError) throw approvalError;

        const { error: batchError } = await supabase
          .from('production_batches')
          .update({
            price_approval_status: 'rejected',
            price_approval_id: approvalData.id,
          })
          .eq('id', selectedBatch.id);

        if (batchError) throw batchError;
      }

      setShowApproveModal(false);
      fetchBatches();
    } catch (error) {
      console.error('Error rejecting price:', error);
      alert('Failed to reject price. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = batches.filter((b) => {
    const matchesTab = tab === 'pending' 
      ? b.approval_status === 'pending' || b.approval_status === null
      : b.approval_status === tab;
    
    if (!matchesTab) return false;
    
    if (!search) return true;
    const s = search.toLowerCase();
    return b.batch_number.toLowerCase().includes(s) || 
           b.formulation_name.toLowerCase().includes(s) ||
           b.sage_code.toLowerCase().includes(s);
  });

  const calculateMargin = (price: number, cost: number) => {
    if (!price || !cost) return 0;
    return ((price - cost) / cost) * 100;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Price Control</h1>
        <p className="text-gray-600 mt-1">Set and approve unit prices for finished goods before dispatch</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search batch, formulation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formulation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price USD</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price ZiG</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{batch.batch_number}</div>
                    <div className="text-xs text-gray-500">{format(new Date(batch.completion_date), 'dd MMM yyyy')}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{batch.formulation_name}</div>
                    <div className="text-xs text-gray-500">{batch.sage_code}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.actual_qty.toLocaleString()} kg
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${batch.cost_per_unit.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${batch.unit_price_usd.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    Z${batch.unit_price_zig.toFixed(2)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {batch.unit_price_usd > 0 ? (
                        <span className={`text-sm font-medium ${
                          calculateMargin(batch.unit_price_usd, batch.cost_per_unit) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {calculateMargin(batch.unit_price_usd, batch.cost_per_unit).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <StatusBadge status={batch.approval_status || 'pending'} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    {tab === 'pending' && (
                      <button
                        onClick={() => openApproveModal(batch)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Set Price
                      </button>
                    )}
                    {tab !== 'pending' && (
                      <button
                        onClick={() => openApproveModal(batch)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No batches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="max-w-2xl">
          {selectedBatch && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Price Approval</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBatch.batch_number} - {selectedBatch.formulation_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Production Cost</div>
                  <div className="text-2xl font-bold text-gray-900">${selectedBatch.cost_per_unit.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Quantity</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedBatch.actual_qty.toLocaleString()} kg</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="number"
                      step="0.01"
                      value={form.unit_price_usd}
                      onChange={(e) => setForm({ ...form, unit_price_usd: parseFloat(e.target.value) || 0 })}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                      disabled={tab !== 'pending'}
                    />
                  </div>
                  {form.unit_price_usd > 0 && (
                    <div className={`text-sm mt-1 ${
                      calculateMargin(form.unit_price_usd, selectedBatch.cost_per_unit) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Margin: {calculateMargin(form.unit_price_usd, selectedBatch.cost_per_unit).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price (ZiG)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">Z$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.unit_price_zig}
                      onChange={(e) => setForm({ ...form, unit_price_zig: parseFloat(e.target.value) || 0 })}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                      disabled={tab !== 'pending'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                    placeholder="Add any notes about this price approval..."
                  />
                </div>
              </div>

              {tab === 'pending' && (
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={saving || form.unit_price_usd <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </button>
                </div>
              )}

              {tab !== 'pending' && (
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
