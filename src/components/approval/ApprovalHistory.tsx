import { useState, useEffect } from 'react';
import { Clock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ApprovalEntry {
  id: string;
  action: string;
  previous_status?: string;
  new_status: string;
  created_at: string;
  approver?: { full_name: string };
}

interface ApprovalHistoryProps {
  entityType: string;
  entityId: string;
}

export default function ApprovalHistory({ entityType, entityId }: ApprovalHistoryProps) {
  const [history, setHistory] = useState<ApprovalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [entityType, entityId]);

  async function fetchHistory() {
    setLoading(true);
    try {
      // For GRN approvals, fetch the GRN and derive approval history from status fields
      if (entityType === 'grn') {
        const { data: grn } = await supabase
          .from('goods_received_notes')
          .select('*, rm_approved_by_user:profiles!rm_approved_by(full_name), accountant_approved_by_user:profiles!accountant_approved_by(full_name)')
          .eq('id', entityId)
          .single();

        if (grn) {
          const entries: ApprovalEntry[] = [];

          // Add RM approval if it exists
          if (grn.rm_approved_at) {
            entries.push({
              id: `rm_${grn.id}`,
              action: 'approved',
              previous_status: 'pending',
              new_status: 'rm_approved',
              created_at: grn.rm_approved_at,
              approver: grn.rm_approved_by_user
            });
          }

          // Add Accountant approval if it exists
          if (grn.accountant_approved_at) {
            entries.push({
              id: `accountant_${grn.id}`,
              action: 'approved',
              previous_status: 'rm_approved',
              new_status: 'approved',
              created_at: grn.accountant_approved_at,
              approver: grn.accountant_approved_by_user
            });
          }

          // Add rejection if it exists
          if (grn.status === 'rejected' && grn.rm_approved_at) {
            entries.push({
              id: `rejected_${grn.id}`,
              action: 'rejected',
              previous_status: 'pending',
              new_status: 'rejected',
              created_at: grn.rm_approved_at,
              approver: grn.rm_approved_by_user
            });
          }

          // Sort by date descending
          entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setHistory(entries);
        }
      }
    } catch (error) {
      console.error('Failed to fetch approval history:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No approval history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Approval History</h3>
      <div className="space-y-3">
        {history.map((entry) => (
          <div key={entry.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${getActionColor(entry.action)}`}>
                  {getActionIcon(entry.action)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 capitalize">
                    {entry.action.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {entry.previous_status && `${entry.previous_status} → `}
                    {entry.new_status}
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
            
            {entry.approver && (
              <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                <User className="w-3 h-3" />
                <span>{entry.approver.full_name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-600',
    approved: 'bg-emerald-100 text-emerald-600',
    rejected: 'bg-red-100 text-red-600',
    cancelled: 'bg-slate-100 text-slate-600',
    reopened: 'bg-orange-100 text-orange-600'
  };
  return colors[action] || 'bg-slate-100 text-slate-600';
}

function getActionIcon(action: string) {
  const icons: Record<string, JSX.Element> = {
    submitted: <Clock className="w-3 h-3" />,
    approved: <Clock className="w-3 h-3" />,
    rejected: <Clock className="w-3 h-3" />,
    cancelled: <Clock className="w-3 h-3" />,
    reopened: <Clock className="w-3 h-3" />
  };
  return icons[action] || <Clock className="w-3 h-3" />;
}
