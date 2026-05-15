// Approval Workflow Types

export interface ApprovalHistory {
  id: string;
  entity_type: 'grn' | 'quality_inspection' | 'production_order' | 'dispatch_order' | 'work_order' | 'reconciliation_period' | 'material_transfer' | 'macropack_order' | 'chick_booking';
  entity_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'reopened';
  previous_status?: string;
  new_status: string;
  approved_by?: string;
  comments?: string;
  created_at: string;
}

export interface PendingApproval {
  entity_type: 'grn' | 'quality_inspection' | 'production_order' | 'dispatch_order' | 'work_order' | 'reconciliation_period' | 'material_transfer' | 'macropack_order' | 'chick_booking';
  entity_id: string;
  entity_number: string;
  entity_name: string;
  status: string;
  created_at: string;
  created_by?: string;
  branch_id?: string;
}

export interface ApprovalHistoryWithUser extends ApprovalHistory {
  approver?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export const APPROVAL_PERMISSIONS = {
  grn: ['raw_material_manager', 'accountant', 'admin'],
  quality_inspection: ['supervisor', 'production_manager', 'admin'],
  production_order: ['production_manager', 'admin'],
  dispatch_order: ['warehouse_manager', 'admin'],
  work_order: ['supervisor', 'admin'],
  reconciliation_period: ['production_manager', 'finance', 'admin'],
  material_transfer: ['raw_material_manager', 'admin'],
  macropack_order: ['raw_material_manager', 'supervisor', 'production_manager', 'admin'],
  chick_booking: ['finance', 'accountant', 'admin'],
} as const;

export function canApprove(entityType: keyof typeof APPROVAL_PERMISSIONS, userRole: string): boolean {
  return APPROVAL_PERMISSIONS[entityType].includes(userRole as any);
}

export function getApprovalActionLabel(entityType: string): { approve: string; reject: string } {
  const labels: Record<string, { approve: string; reject: string }> = {
    grn: { approve: 'Approve Receipt', reject: 'Reject Receipt' },
    quality_inspection: { approve: 'Pass Inspection', reject: 'Fail Inspection' },
    production_order: { approve: 'Approve Order', reject: 'Reject Order' },
    dispatch_order: { approve: 'Approve Dispatch', reject: 'Reject Dispatch' },
    work_order: { approve: 'Approve Work', reject: 'Reject Work' },
    reconciliation_period: { approve: 'Approve Period', reject: 'Reject Period' },
    material_transfer: { approve: 'Approve Transfer', reject: 'Reject Transfer' },
  macropack_order: { approve: 'Approve Macropack Order', reject: 'Reject Macropack Order' },
  chick_booking: { approve: 'Approve Chick PO', reject: 'Reject Chick PO' },
  };
  return labels[entityType] || { approve: 'Approve', reject: 'Reject' };
}
