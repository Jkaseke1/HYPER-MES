import { useState } from 'react';
import { Check, X, Loader2, ArrowRight, Package, Factory } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { TWO_STEP_MATERIAL_TRANSFER } from '../../types/approval';

interface MaterialTransferApprovalButtonsProps {
  transferId: string;
  currentStatus: string;
  quantity: number;
  rawMaterialId: string;
  fromWarehouseId: string;
  onApproved: () => void;
  onRejected: () => void;
}

export default function MaterialTransferApprovalButtons({
  transferId,
  currentStatus,
  quantity,
  rawMaterialId,
  fromWarehouseId,
  onApproved,
  onRejected,
}: MaterialTransferApprovalButtonsProps) {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const userRole = profile?.role || '';

  // Normalize status to avoid TypeScript narrowing issues
  const status = String(currentStatus);

  // Determine which step the user can approve
  const canApproveStep1 = TWO_STEP_MATERIAL_TRANSFER.step1.roles.includes(userRole as any) && status === 'pending';
  const canApproveStep2 = TWO_STEP_MATERIAL_TRANSFER.step2.roles.includes(userRole as any) && status === 'in_buffer';

  if (!canApproveStep1 && !canApproveStep2) {
    return null;
  }

  function renderStepIndicator(current: string) {
    return (
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between text-xs">
          <div className={`flex items-center gap-2 ${
            current === 'pending' ? 'text-amber-600 font-semibold' : 
            current === 'in_buffer' || current === 'received' ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            <Package className="w-4 h-4" />
            <span>1. RM Warehouse</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
          <div className={`flex items-center gap-2 ${
            current === 'in_buffer' ? 'text-amber-600 font-semibold' : 
            current === 'received' ? 'text-emerald-600' : 'text-slate-400'
          }`}>
            <Package className="w-4 h-4" />
            <span>2. Buffer</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
          <div className={`flex items-center gap-2 ${
            current === 'received' ? 'text-emerald-600 font-semibold' : 'text-slate-400'
          }`}>
            <Factory className="w-4 h-4" />
            <span>3. Production</span>
          </div>
        </div>
      </div>
    );
  }

  async function handleStep1Approve() {
    // Step 1: Release to Buffer Warehouse
    // - Deduct stock from RM Warehouse
    // - Add stock to Buffer Warehouse
    // - Update status to 'in_buffer'
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      // Get Buffer Warehouse ID
      const { data: bufferWarehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('code', 'BUFFER')
        .single();

      if (!bufferWarehouse) {
        throw new Error('Buffer Warehouse not found. Please run the migration.');
      }

      // 1. Deduct stock from RM Warehouse balance
      const { data: rmBalance } = await supabase
        .from('warehouse_stock_balances')
        .select('quantity')
        .eq('raw_material_id', rawMaterialId)
        .eq('warehouse_id', fromWarehouseId)
        .single();

      if (!rmBalance || (rmBalance.quantity || 0) < quantity) {
        throw new Error('Insufficient stock in Raw Materials Warehouse');
      }

      await supabase.rpc('update_warehouse_balance', {
        p_raw_material_id: rawMaterialId,
        p_warehouse_id: fromWarehouseId,
        p_quantity_delta: -quantity
      });

      // 2. Add stock to Buffer Warehouse balance
      await supabase.rpc('update_warehouse_balance', {
        p_raw_material_id: rawMaterialId,
        p_warehouse_id: bufferWarehouse.id,
        p_quantity_delta: quantity
      });

      // 3. Record stock movements
      await supabase.from('stock_movements').insert({
        raw_material_id: rawMaterialId,
        movement_type: 'transfer',
        quantity: -quantity,
        warehouse_id: fromWarehouseId,
        reference_type: 'material_transfer',
        reference_id: transferId,
        notes: 'Step 1: Transfer out of Raw Materials Warehouse to Buffer',
        performed_by: user.id,
      });

      await supabase.from('stock_movements').insert({
        raw_material_id: rawMaterialId,
        movement_type: 'transfer',
        quantity: quantity,
        warehouse_id: bufferWarehouse.id,
        reference_type: 'material_transfer',
        reference_id: transferId,
        notes: 'Step 1: Transfer into Buffer Warehouse',
        performed_by: user.id,
      });

      // 4. Update transfer status
      const { error: updateError } = await supabase
        .from('material_transfers')
        .update({
          status: 'in_buffer',
          buffer_approved_by: user.id,
          buffer_approved_at: new Date().toISOString(),
          buffer_warehouse_id: bufferWarehouse.id,
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      // Log approval
      try {
        await supabase.rpc('log_approval_action', {
          p_entity_type: 'material_transfer',
          p_entity_id: transferId,
          p_action: 'buffer_approved',
          p_previous_status: 'pending',
          p_new_status: 'in_buffer',
          p_approved_by: user.id,
          p_comments: 'Released to Buffer Warehouse'
        });
      } catch (logError) {
        console.warn('Failed to log approval:', logError);
      }

      onApproved();
    } catch (error) {
      console.error('Step 1 approval error:', error);
      alert('Failed to release to buffer. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleStep2Approve() {
    // Step 2: Accept to Production
    // - Deduct stock from Buffer Warehouse
    // - Record transfer to Production Floor
    // - Update status to 'received'
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      // Get Buffer Warehouse ID
      const { data: bufferWarehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('code', 'BUFFER')
        .single();

      if (!bufferWarehouse) {
        throw new Error('Buffer Warehouse not found');
      }

      // 1. Deduct stock from Buffer Warehouse
      const { data: bufferBalance } = await supabase
        .from('warehouse_stock_balances')
        .select('quantity')
        .eq('raw_material_id', rawMaterialId)
        .eq('warehouse_id', bufferWarehouse.id)
        .single();

      if (!bufferBalance || (bufferBalance.quantity || 0) < quantity) {
        throw new Error('Insufficient stock in Buffer Warehouse');
      }

      await supabase.rpc('update_warehouse_balance', {
        p_raw_material_id: rawMaterialId,
        p_warehouse_id: bufferWarehouse.id,
        p_quantity_delta: -quantity
      });

      // 2. Record stock movement to production floor
      await supabase.from('stock_movements').insert({
        raw_material_id: rawMaterialId,
        movement_type: 'production_input',
        quantity: quantity,
        warehouse_id: bufferWarehouse.id,
        reference_type: 'material_transfer',
        reference_id: transferId,
        notes: 'Step 2: Transfer from Buffer to Production Floor',
        performed_by: user.id,
      });

      // 3. Decrease global raw_materials current_stock (stock consumed by production)
      const { data: currentRM } = await supabase
        .from('raw_materials')
        .select('current_stock')
        .eq('id', rawMaterialId)
        .single();

      if (currentRM) {
        const newStock = Math.max(0, (currentRM.current_stock || 0) - quantity);
        await supabase
          .from('raw_materials')
          .update({ current_stock: newStock })
          .eq('id', rawMaterialId);
      }

      // 4. Update transfer status
      const { error: updateError } = await supabase
        .from('material_transfers')
        .update({
          status: 'received',
          production_approved_by: user.id,
          production_approved_at: new Date().toISOString(),
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      // Log approval
      try {
        await supabase.rpc('log_approval_action', {
          p_entity_type: 'material_transfer',
          p_entity_id: transferId,
          p_action: 'production_approved',
          p_previous_status: 'in_buffer',
          p_new_status: 'received',
          p_approved_by: user.id,
          p_comments: 'Accepted to Production Floor'
        });
      } catch (logError) {
        console.warn('Failed to log approval:', logError);
      }

      onApproved();
    } catch (error) {
      console.error('Step 2 approval error:', error);
      alert('Failed to accept to production. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      // If rejecting from in_buffer, return stock to RM Warehouse
      if (status === 'in_buffer') {
        // Get Buffer Warehouse ID
        const { data: bufferWarehouse } = await supabase
          .from('warehouses')
          .select('id')
          .eq('code', 'BUFFER')
          .single();

        if (bufferWarehouse) {
          // Deduct from Buffer, return to RM
          await supabase.rpc('update_warehouse_balance', {
            p_raw_material_id: rawMaterialId,
            p_warehouse_id: bufferWarehouse.id,
            p_quantity_delta: -quantity
          });

          await supabase.rpc('update_warehouse_balance', {
            p_raw_material_id: rawMaterialId,
            p_warehouse_id: fromWarehouseId,
            p_quantity_delta: quantity
          });
        }

        // Record reversal movements
        await supabase.from('stock_movements').insert({
          raw_material_id: rawMaterialId,
          movement_type: 'transfer',
          quantity: -quantity,
          warehouse_id: bufferWarehouse?.id,
          reference_type: 'material_transfer',
          reference_id: transferId,
          notes: `Rejection reversal: ${rejectionReason}`,
          performed_by: user.id,
        });

        await supabase.from('stock_movements').insert({
          raw_material_id: rawMaterialId,
          movement_type: 'transfer',
          quantity: quantity,
          warehouse_id: fromWarehouseId,
          reference_type: 'material_transfer',
          reference_id: transferId,
          notes: `Rejection return: ${rejectionReason}`,
          performed_by: user.id,
        });
      }

      const { error: updateError } = await supabase
        .from('material_transfers')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      // Log rejection
      try {
        await supabase.rpc('log_approval_action', {
          p_entity_type: 'material_transfer',
          p_entity_id: transferId,
          p_action: 'rejected',
          p_previous_status: currentStatus,
          p_new_status: 'rejected',
          p_approved_by: user.id,
          p_comments: rejectionReason
        });
      } catch (logError) {
        console.warn('Failed to log rejection:', logError);
      }

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
      {/* Step indicator */}
      {renderStepIndicator(status)}

      <div className="flex items-center gap-2">
        {canApproveStep1 && (
          <button
            onClick={handleStep1Approve}
            disabled={processing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Release to Buffer
          </button>
        )}

        {canApproveStep2 && (
          <button
            onClick={handleStep2Approve}
            disabled={processing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Accept to Production
          </button>
        )}

        <button
          onClick={() => setShowRejectModal(true)}
          disabled={processing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Reject Transfer</h3>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for rejecting this material transfer:
              {currentStatus === 'in_buffer' && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Stock will be returned to RM Warehouse
                </span>
              )}
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
