import { useState, useEffect, useCallback } from 'react';
import { Search, Check, X, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent } from '../components/ui/dialog';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';

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
  const { profile } = useAuth();
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

    setBatches(data as BatchWithPriceApproval[]);
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

    // Check if user has finance role
    if (profile?.role !== 'finance' && profile?.role !== 'admin') {
      alert('Only finance users can approve prices.');
      return;
    }

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

        // Update production order
        const { error: batchError } = await supabase
          .from('production_orders')
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

    // Check if user has finance role
    if (profile?.role !== 'finance' && profile?.role !== 'admin') {
      alert('Only finance users can reject prices.');
      return;
    }

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

  const stats = {
    pending: batches.filter(b => b.approval_status === 'pending' || b.approval_status === null).length,
    approved: batches.filter(b => b.approval_status === 'approved').length,
    rejected: batches.filter(b => b.approval_status === 'rejected').length,
  };

  const calculateMargin = (price: number, cost: number) => {
    if (!price || !cost) return 0;
    return ((price - cost) / cost) * 100;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Price Control</h1>
          <p className="text-sm text-slate-500 mt-1">Set and approve unit prices for finished goods before dispatch</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-0.5 text-xl font-bold text-amber-900">{stats.pending}</p>
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Approved</p>
            <p className="mt-0.5 text-xl font-bold text-green-900">{stats.approved}</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <X className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Rejected</p>
            <p className="mt-0.5 text-xl font-bold text-red-900">{stats.rejected}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-slate-800">Price Approvals</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search batch, formulation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-64"
              />
            </div>
          </div>
        </div>

        <div className="flex space-x-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Batch</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Formulation</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Qty</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Cost/Unit</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Price USD</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Price ZiG</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Margin</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((batch) => (
                <tr key={batch.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 min-w-[140px]">
                    <div className="text-sm font-medium text-slate-900">{batch.batch_number}</div>
                    <div className="text-xs text-slate-500">{format(new Date(batch.completion_date), 'dd MMM yyyy')}</div>
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    <div className="text-sm text-slate-900">{batch.formulation_name}</div>
                    <div className="text-xs text-slate-500">{batch.sage_code}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    {batch.actual_qty.toLocaleString()} kg
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    ${batch.cost_per_unit ? batch.cost_per_unit.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    ${batch.unit_price_usd ? batch.unit_price_usd.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    Z${batch.unit_price_zig ? batch.unit_price_zig.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {batch.unit_price_usd && batch.cost_per_unit ? (
                      <span className={`text-sm font-medium ${
                        calculateMargin(batch.unit_price_usd, batch.cost_per_unit) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {calculateMargin(batch.unit_price_usd, batch.cost_per_unit).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={batch.approval_status || 'pending'} />
                  </td>
                  <td className="px-3 py-2">
                    {tab === 'pending' && (
                      <button
                        onClick={() => openApproveModal(batch)}
                        className="text-teal-600 hover:text-teal-800 font-medium"
                      >
                        Set Price
                      </button>
                    )}
                    {tab !== 'pending' && (
                      <button
                        onClick={() => openApproveModal(batch)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No batches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="max-w-2xl p-0">
          <div className="shrink-0 border-b bg-slate-900 text-white px-5 py-3 rounded-t-lg relative">
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Price Approval</h2>
                  <p className="text-slate-400 text-xs">{selectedBatch?.batch_number} - {selectedBatch?.formulation_name}</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
                {tab === 'pending' ? 'Pending' : tab === 'approved' ? 'Approved' : 'Rejected'}
              </span>
            </div>
            <button
              onClick={() => setShowApproveModal(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4 bg-gradient-to-b from-slate-200/80 via-slate-100 to-slate-300/70">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Production Cost</div>
                <div className="mt-1 text-xl font-bold text-slate-900">${selectedBatch?.cost_per_unit ? selectedBatch.cost_per_unit.toFixed(2) : '-'}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quantity</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{selectedBatch?.actual_qty.toLocaleString()} kg</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300/70 bg-slate-50/95 shadow-sm p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800">Pricing Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Unit Price (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="number"
                      step="0.01"
                      value={form.unit_price_usd}
                      onChange={(e) => setForm({ ...form, unit_price_usd: parseFloat(e.target.value) || 0 })}
                      className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full"
                      disabled={tab !== 'pending'}
                    />
                  </div>
                  {form.unit_price_usd > 0 && selectedBatch && (
                    <div className={`text-xs mt-1 font-medium ${
                      calculateMargin(form.unit_price_usd, selectedBatch.cost_per_unit) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Margin: {calculateMargin(form.unit_price_usd, selectedBatch.cost_per_unit).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Unit Price (ZiG)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">Z$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.unit_price_zig}
                      onChange={(e) => setForm({ ...form, unit_price_zig: parseFloat(e.target.value) || 0 })}
                      className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full"
                      disabled={tab !== 'pending'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full"
                    placeholder="Add any notes about this price approval..."
                  />
                </div>
              </div>
            </div>

            {tab === 'pending' && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center text-sm font-medium"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={saving || form.unit_price_usd <= 0}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center text-sm font-medium"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </button>
              </div>
            )}

            {tab !== 'pending' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
