import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface GRNApprovalButtonsProps {
  grnId: string;
  currentStatus: string;
  rm_approved_at?: string | null;
  accountant_approved_at?: string | null;
  onApproved: () => void;
  onRejected: () => void;
  className?: string;
}

export default function GRNApprovalButtons({
  grnId,
  currentStatus,
  rm_approved_at,
  accountant_approved_at,
  onApproved,
  onRejected,
  className = ''
}: GRNApprovalButtonsProps) {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Check if user is Raw Material Manager or Admin
  const isRawMaterialManager = profile?.role === 'raw_material_manager' || profile?.role === 'admin';
  
  // Check if user is Accountant or Admin
  const isAccountant = profile?.role === 'accountant' || profile?.role === 'admin';

  // Step 1: Raw Material Manager approval (pending → rm_approved)
  // Only show if status is pending AND no rm_approved_at timestamp exists yet (prevents duplicate approval)
  const canApproveStep1 = isRawMaterialManager && currentStatus === 'pending' && !rm_approved_at;
  
  // Step 2: Accountant approval (rm_approved → approved)
  // Only show if status is rm_approved AND no accountant_approved_at timestamp exists yet (prevents duplicate approval)
  const canApproveStep2 = isAccountant && currentStatus === 'rm_approved' && !accountant_approved_at;
  
  // Only Raw Material Manager can reject at Step 1
  const canReject = isRawMaterialManager && currentStatus === 'pending';

  if (!canApproveStep1 && !canApproveStep2 && !canReject) {
    return null;
  }

  async function handleApprove() {
    if (!profile) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      let updateData: any = {};
      let newStatus: string = '';

      if (currentStatus === 'pending') {
        // Step 1: Raw Material Manager approval
        updateData = {
          status: 'rm_approved',
          rm_approved_by: user.id,
          rm_approved_at: new Date().toISOString()
        };
        newStatus = 'rm_approved';
      } else if (currentStatus === 'rm_approved') {
        // Step 2: Accountant approval
        updateData = {
          status: 'approved',
          accountant_approved_by: user.id,
          accountant_approved_at: new Date().toISOString()
        };
        newStatus = 'approved';
      }

      // Update GRN status
      const { error: updateError } = await supabase
        .from('goods_received_notes')
        .update(updateData)
        .eq('id', grnId);

      if (updateError) throw updateError;

      // Auto-create rm_cost_register entries when GRN is fully approved
      if (newStatus === 'approved') {
        try {
          // Fetch GRN details and line items
          const [grnRes, itemsRes, latestRateRes] = await Promise.all([
            supabase.from('goods_received_notes').select('received_date').eq('id', grnId).single(),
            supabase.from('grn_items').select('raw_material_id, received_qty, unit_cost').eq('grn_id', grnId),
            supabase.from('usd_zig_rate_history').select('rate').order('effective_date', { ascending: false }).limit(1),
          ]);

          const grnDate = grnRes.data?.received_date;
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
          }
        } catch (costError) {
          console.warn('Failed to auto-create RM cost entries:', costError);
        }
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
          rm_approved_by: user.id,
          rm_approved_at: new Date().toISOString(),
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
        {/* Step 1: Raw Material Manager Approval */}
        {canApproveStep1 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-800 mb-2">Step 1: Receipt Approval</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve Receipt
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

        {/* Step 2: Accountant Approval */}
        {canApproveStep2 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-800 mb-2">Step 2: Finance Approval</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Finance Approve
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
