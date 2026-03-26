import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { canApprove } from '../../types/approval';
import StatusBadge from '../ui/StatusBadge';

interface PendingApproval {
  entity_type: string;
  entity_id: string;
  entity_number: string;
  entity_name: string;
  status: string;
  created_at: string;
  created_by?: string;
  branch_id?: string;
}

export default function PendingApprovalsWidget() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  async function fetchPendingApprovals() {
    setLoading(true);
    const { data } = await supabase
      .from('pending_approvals')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(10);

    if (data && profile?.role) {
      // Filter to only show items the user can approve
      const filtered = data.filter((item: PendingApproval) => 
        canApprove(item.entity_type as any, profile.role)
      );
      setApprovals(filtered);
    }
    setLoading(false);
  }

  function navigateToEntity(approval: PendingApproval) {
    const routes: Record<string, string> = {
      grn: '/goods-received',
      quality_inspection: '/quality-inspection',
      production_order: '/production-orders',
      dispatch_order: '/dispatch',
      work_order: '/maintenance-work-orders',
      reconciliation_period: '/reconciliation'
    };
    const route = routes[approval.entity_type];
    if (route) navigate(route);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Pending Approvals</h3>
              <p className="text-xs text-slate-500">Items requiring your approval</p>
            </div>
          </div>
          {approvals.length > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {approvals.length}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {approvals.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No pending approvals</p>
            <p className="text-xs text-slate-400 mt-1">All caught up!</p>
          </div>
        ) : (
          approvals.map((approval) => (
            <button
              key={`${approval.entity_type}-${approval.entity_id}`}
              onClick={() => navigateToEntity(approval)}
              className="w-full px-6 py-4 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {approval.entity_name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {approval.entity_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={approval.status} />
                    <span className="text-xs text-slate-400">
                      {new Date(approval.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0 ml-2" />
              </div>
            </button>
          ))
        )}
      </div>

      {approvals.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Click any item to review and approve
          </p>
        </div>
      )}
    </div>
  );
}
