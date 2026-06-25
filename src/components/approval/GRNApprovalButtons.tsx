import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface GRNApprovalButtonsProps {
  grnId: string;
  currentStatus: string;
  onApproved: () => void;
  onRejected: () => void;
  className?: string;
}

export default function GRNApprovalButtons({
  grnId,
  currentStatus,
  onApproved,
  onRejected,
  className = ''
}: GRNApprovalButtonsProps) {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Single-step approval: Finance, Accountant, or Admin can approve
  const canApprove = (
    profile?.role === 'finance' || 
    profile?.role === 'accountant' || 
    profile?.role === 'admin'
  ) && currentStatus === 'pending';
  
  // Same roles can reject
  const canReject = canApprove;

  if (!canApprove && !canReject) {
    return null;
  }

  async function handleApprove() {
    if (!profile) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      // Single-step approval: pending → approved
      const updateData = {
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      };

      // Update GRN status
      const { error: updateError } = await supabase
        .from('goods_received_notes')
        .update(updateData)
        .eq('id', grnId);

      if (updateError) throw updateError;

      // Auto-create rm_cost_register entries when GRN is approved
      try {
        // Fetch GRN details and line items
        const [grnRes, itemsRes, latestRateRes] = await Promise.all([
          supabase.from('goods_received_notes').select('received_date, grn_number').eq('id', grnId).single(),
          supabase.from('grn_items').select('raw_material_id, received_qty, unit_cost, raw_materials(name)').eq('grn_id', grnId),
          supabase.from('usd_zig_rate_history').select('rate').order('effective_date', { ascending: false }).limit(1),
        ]);

        const grnDate = grnRes.data?.received_date;
        const grnNumber = grnRes.data?.grn_number;
        const items = itemsRes.data || [];
        const latestRate = latestRateRes.data?.[0]?.rate || null;

        if (items.length > 0 && grnDate) {
          const costEntries = items.map((item: any) => ({
            raw_material_id: item.raw_material_id,
            cost_per_tonne_usd: item.unit_cost * 1000,
            effective_date: grnDate,
            source: 'GRN',
            grn_id: grnId,
            usd_zig_rate: latestRate,
            created_by: user.id,
          }));

          await supabase.from('rm_cost_register').insert(costEntries);

          // Auto-link to DRS receipts
          const receiptEntries = items.map((item: any) => ({
            receipt_date: grnDate,
            raw_material_name: item.raw_materials?.name || 'Unknown',
            quantity_kg: item.received_qty,
            grn_reference: grnNumber || grnId,
          }));
          await supabase.from('rm_daily_receipts').insert(receiptEntries);
        }

        // Write sync_log entry for bridge worker to pick up (Sage integration)
        const { error: syncError } = await supabase
          .from('sync_log')
          .insert({
            event_type: 'grn_confirmed',
            reference_type: 'goods_received_notes',
            reference_id: grnId,
            status: 'pending',
            description: `GRN ${grnNumber} approved by Finance`,
            created_at: new Date().toISOString(),
          });
        if (syncError) {
          console.warn('sync_log write failed:', syncError.message);
          // Don't throw — GRN is approved, bridge will need manual retry
        }
      } catch (costError) {
        console.warn('Failed to auto-create RM cost entries:', costError);
      }

      onApproved();
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!profile || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      // Update GRN status to rejected
      const { error: updateError } = await supabase
        .from('goods_received_notes')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', grnId);

      if (updateError) throw updateError;

      setShowRejectModal(false);
      setRejectionReason('');
      onRejected();
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Finance Approval - Single Step */}
        {canApprove && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-800 mb-2">Finance Approval Required</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve GRN
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Reject GRN</h3>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for rejecting this Goods Received Note:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              placeholder="Enter rejection reason..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
