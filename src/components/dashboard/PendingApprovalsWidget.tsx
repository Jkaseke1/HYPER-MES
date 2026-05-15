import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { canApprove } from '../../types/approval';
import StatusBadge from '../ui/StatusBadge';

const CATEGORY_META: Record<string, { label: string; pill: string }> = {
  grn:                   { label: 'GRN',            pill: 'bg-blue-100 text-blue-700' },
  quality_inspection:    { label: 'Quality',         pill: 'bg-purple-100 text-purple-700' },
  production_order:      { label: 'Production',      pill: 'bg-teal-100 text-teal-700' },
  macropack_order:       { label: 'Macropack',       pill: 'bg-orange-100 text-orange-700' },
  dispatch_order:        { label: 'Dispatch',        pill: 'bg-indigo-100 text-indigo-700' },
  work_order:            { label: 'Maintenance',     pill: 'bg-slate-100 text-slate-600' },
  reconciliation_period: { label: 'Reconciliation',  pill: 'bg-emerald-100 text-emerald-700' },
  chick_booking:         { label: 'Chick Bookings',  pill: 'bg-emerald-100 text-emerald-700' },
};

const STAGE_META: Record<string, string> = {
  PENDING_RM:         'bg-sky-100 text-sky-700',
  PENDING_SUPERVISOR: 'bg-violet-100 text-violet-700',
};

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

interface WidgetProps { limit?: number; compact?: boolean; }

export default function PendingApprovalsWidget({ limit = 10, compact = false }: WidgetProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [creatorNames, setCreatorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingApprovals();
  }, [limit]);

  async function fetchPendingApprovals() {
    setLoading(true);
    const { data } = await supabase
      .from('pending_approvals')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    // Get total count (filtered by role on client side)
    const { data: allData } = await supabase.from('pending_approvals').select('entity_type');
    if (allData && profile?.role) {
      const total = allData.filter((i: any) => canApprove(i.entity_type, profile.role)).length;
      setTotalCount(total);
    }

    if (data && profile?.role) {
      const filtered = data.filter((item: PendingApproval) =>
        canApprove(item.entity_type as any, profile.role)
      );
      setApprovals(filtered);

      const ids = [...new Set(filtered.map((a: PendingApproval) => a.created_by).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);
        const map = new Map<string, string>();
        profiles?.forEach((p: { id: string; full_name: string }) => map.set(p.id, p.full_name));
        setCreatorNames(map);
      }
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
      reconciliation_period: '/reconciliation',
      macropack_order: '/macropack-manufacturing',
      chick_booking: '/chick-bookings',
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

  const pad = compact ? 'px-4 py-2.5' : 'px-6 py-4';
  const headerPad = compact ? 'px-4 py-3' : 'px-6 py-4';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className={`${headerPad} border-b border-slate-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`${compact ? 'p-1.5' : 'p-2'} bg-amber-100 rounded-lg`}>
              <Clock className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-amber-600`} />
            </div>
            <div>
              <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-slate-800`}>Pending Approvals</h3>
              <p className="text-xs text-slate-500">Items requiring your approval</p>
            </div>
          </div>
          {totalCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {approvals.length === 0 ? (
          <div className={`${compact ? 'px-4 py-5' : 'px-6 py-8'} text-center`}>
            <AlertCircle className={`${compact ? 'w-7 h-7' : 'w-10 h-10'} text-slate-300 mx-auto mb-2`} />
            <p className="text-sm text-slate-500">No pending approvals</p>
            <p className="text-xs text-slate-400 mt-1">All caught up!</p>
          </div>
        ) : (() => {
          // Group by entity_type for categorised sections
          const grouped = approvals.reduce<Record<string, PendingApproval[]>>((acc, a) => {
            (acc[a.entity_type] = acc[a.entity_type] || []).push(a);
            return acc;
          }, {});
          return Object.entries(grouped).map(([type, items]) => {
            const meta = CATEGORY_META[type] || { label: type, pill: 'bg-slate-100 text-slate-600' };
            return (
              <div key={type}>
                {/* Category header */}
                <div className="px-4 py-1.5 bg-slate-50 border-y border-slate-100 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.pill}`}>{meta.label}</span>
                  <span className="text-[11px] text-slate-400">{items.length} pending</span>
                </div>
                {/* Items in this category */}
                {items.map((approval) => {
                  const stagePill = STAGE_META[approval.status];
                  return (
                    <button
                      key={`${approval.entity_type}-${approval.entity_id}`}
                      onClick={() => navigateToEntity(approval)}
                      className={`w-full ${pad} hover:bg-slate-50 transition-colors text-left group border-b border-slate-100 last:border-b-0`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-800 truncate">
                              {approval.entity_name}
                            </span>
                            <span className="text-xs text-slate-500 font-mono shrink-0">
                              {approval.entity_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {stagePill ? (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${stagePill}`}>
                                {approval.status.replace('_', ' ')}
                              </span>
                            ) : (
                              <StatusBadge status={approval.status} />
                            )}
                            {approval.created_by && creatorNames.get(approval.created_by) && (
                              <span className="text-xs text-slate-500 truncate">
                                By <span className="font-medium text-slate-700">{creatorNames.get(approval.created_by)}</span>
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(approval.created_at).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      {approvals.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {totalCount > approvals.length ? `Showing ${approvals.length} of ${totalCount}` : 'Click an item to review'}
          </p>
          {totalCount > approvals.length && (
            <button onClick={() => navigate('/goods-received')} className="text-xs font-semibold text-teal-600 hover:text-teal-700">
              View all →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
