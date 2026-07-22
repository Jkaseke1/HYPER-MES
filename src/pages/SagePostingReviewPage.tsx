import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, DollarSign, Package,
  Building2, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatCard from '../components/ui/StatCard';

interface SagePostingReview {
  id: string;
  sync_event_id: string;
  event_type: string;
  event_description: string | null;
  sage_code: string;
  transaction_type: string;
  sage_tx_code: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  warehouse_id: number;
  warehouse_code: string | null;
  reference: string | null;
  reference2: string | null;
  description: string | null;
  transaction_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  posted_at: string | null;
  sage_result: any;
  created_at: string;
}

interface ReviewGroup {
  key: string;
  sync_event_id: string;
  event_type: string;
  event_description: string | null;
  reference: string | null;
  lines: SagePostingReview[];
  status: 'pending' | 'approved' | 'rejected' | 'mixed';
  allPosted: boolean;
  totalValue: number;
  lineCount: number;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  grn_confirmed: 'GRN Receipt',
  materials_issued: 'RM Issue (Production Order)',
  production_completed: 'Batch Complete',
  dispatch_delivered: 'Dispatch',
  macropack_manufactured: 'Macropack',
  macropack_completed: 'Macropack',
  reconciliation_variance_approved: 'Recon Variance',
};

const TX_LABELS: Record<string, string> = {
  GRV: 'Goods Received',
  MFDR: 'Material Issue / Stock Out',
  MFMF: 'Manufacture / Stock In',
  WHT: 'Warehouse Transfer',
  ADJ: 'Adjustment',
};

function groupStatus(lines: SagePostingReview[]): ReviewGroup['status'] {
  const statuses = new Set(lines.map((l) => l.status));
  if (statuses.size === 1) return lines[0].status;
  return 'mixed';
}

function buildGroups(reviews: SagePostingReview[]): ReviewGroup[] {
  const map = new Map<string, SagePostingReview[]>();
  for (const r of reviews) {
    const key = r.sync_event_id || r.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const groups: ReviewGroup[] = [];
  for (const [key, lines] of map) {
    lines.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const first = lines[0];
    groups.push({
      key,
      sync_event_id: first.sync_event_id,
      event_type: first.event_type,
      event_description: first.event_description || lines.find((l) => l.event_description)?.event_description || null,
      reference: first.reference || lines.find((l) => l.reference)?.reference || null,
      lines,
      status: groupStatus(lines),
      allPosted: lines.every((l) => !!l.posted_at || l.status === 'rejected'),
      totalValue: lines.reduce((sum, l) => sum + Number(l.total_value || 0), 0),
      lineCount: lines.length,
      created_at: first.created_at,
    });
  }

  groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return groups;
}

export default function SagePostingReviewPage() {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<SagePostingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectGroup, setRejectGroup] = useState<ReviewGroup | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [batchApproving, setBatchApproving] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isFinance = profile?.role === 'finance' || profile?.role === 'accountant' || profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sage_posting_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(`Failed to load: ${error.message}`);
    } else {
      setReviews(data || []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const groups = useMemo(() => buildGroups(reviews), [reviews]);

  const approveGroup = async (group: ReviewGroup) => {
    const pendingIds = group.lines.filter((l) => l.status === 'pending').map((l) => l.id);
    if (pendingIds.length === 0) {
      toast.error('No pending lines in this package');
      return;
    }

    setActingKey(group.key);
    const { error } = await supabase
      .from('sage_posting_reviews')
      .update({
        status: 'approved',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', pendingIds);

    setActingKey(null);

    if (error) {
      toast.error(`Failed to approve package: ${error.message}`);
    } else {
      toast.success(
        `Approved ${EVENT_LABELS[group.event_type] || group.event_type}` +
          (group.reference ? ` — ${group.reference}` : '') +
          ` (${pendingIds.length} line${pendingIds.length === 1 ? '' : 's'})`
      );
      fetchData();
    }
  };

  const handleReject = async () => {
    if (!rejectGroup) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const pendingIds = rejectGroup.lines.filter((l) => l.status === 'pending').map((l) => l.id);
    if (pendingIds.length === 0) {
      toast.error('No pending lines to reject');
      return;
    }

    setActingKey(rejectGroup.key);
    const { error } = await supabase
      .from('sage_posting_reviews')
      .update({
        status: 'rejected',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .in('id', pendingIds);

    setActingKey(null);

    if (error) {
      toast.error(`Failed to reject package: ${error.message}`);
    } else {
      toast.success(`Rejected package (${pendingIds.length} lines)`);
      setRejectGroup(null);
      setRejectReason('');
      fetchData();
    }
  };

  const handleBatchApprove = async () => {
    const pendingGroups = groups.filter((g) => g.status === 'pending' || g.lines.some((l) => l.status === 'pending'));
    if (pendingGroups.length === 0) {
      toast.error('No pending packages to approve');
      return;
    }

    setBatchApproving(true);
    let successCount = 0;
    for (const group of pendingGroups) {
      const pendingIds = group.lines.filter((l) => l.status === 'pending').map((l) => l.id);
      if (pendingIds.length === 0) continue;
      const { error } = await supabase
        .from('sage_posting_reviews')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', pendingIds);
      if (!error) successCount++;
    }
    setBatchApproving(false);
    toast.success(`Approved ${successCount} of ${pendingGroups.length} packages`);
    fetchData();
  };

  const pendingLineCount = reviews.filter((r) => r.status === 'pending').length;
  const pendingGroupCount = groups.filter((g) => g.lines.some((l) => l.status === 'pending')).length;
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;
  const postedCount = reviews.filter((r) => r.posted_at).length;
  const totalValue = reviews.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.total_value), 0);

  const getStatusBadge = (group: ReviewGroup) => {
    if (group.status === 'approved' && group.allPosted) {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Posted</Badge>;
    }
    if (group.status === 'approved') {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Approved — Waiting Post</Badge>;
    }
    if (group.status === 'rejected') {
      return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
    }
    if (group.status === 'mixed') {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Mixed</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Review</Badge>;
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isFinance) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">You need Finance or Admin access to review Sage postings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sage Posting Review</h1>
          <p className="text-sm text-slate-500 mt-1">
            One approval per event package (e.g. full production order issue). Line details expand below.
          </p>
        </div>
        {pendingGroupCount > 0 && (
          <Button onClick={handleBatchApprove} disabled={batchApproving} className="bg-emerald-600 hover:bg-emerald-700">
            {batchApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve All Packages ({pendingGroupCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Pending Packages" value={pendingGroupCount.toString()} icon={Clock} color="amber" />
        <StatCard title="Pending Lines" value={pendingLineCount.toString()} icon={Package} color="slate" />
        <StatCard title="Approved Lines" value={approvedCount.toString()} icon={CheckCircle2} color="blue" />
        <StatCard title="Posted to Sage" value={postedCount.toString()} icon={Package} color="emerald" />
        <StatCard title="Pending Value" value={`$${totalValue.toFixed(2)}`} icon={DollarSign} color="slate" />
      </div>

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Loading reviews...</p>
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No {filter !== 'all' ? filter : ''} packages found</p>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => {
            const isOpen = !!expanded[group.key];
            const hasPending = group.lines.some((l) => l.status === 'pending');
            const codes = [...new Set(group.lines.map((l) => l.sage_code))].slice(0, 6);
            const moreCodes = group.lineCount - codes.length;

            return (
              <Card key={group.key} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.key)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-start gap-2">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {EVENT_LABELS[group.event_type] || group.event_type}
                            </span>
                            {getStatusBadge(group)}
                            <Badge variant="outline" className="text-[10px]">
                              {group.lineCount} line{group.lineCount === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 truncate">
                            {group.event_description || '—'}
                            {group.reference ? ` · Ref ${group.reference}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">
                            {codes.join(', ')}
                            {moreCodes > 0 ? ` +${moreCodes} more` : ''}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center justify-between lg:justify-end gap-4 lg:pl-2">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800">${group.totalValue.toFixed(2)}</div>
                        <div className="text-[11px] text-slate-400">package value</div>
                      </div>
                      {hasPending && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={actingKey === group.key}
                            onClick={() => approveGroup(group)}
                          >
                            {actingKey === group.key ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Approve package
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            disabled={actingKey === group.key}
                            onClick={() => {
                              setRejectGroup(group);
                              setRejectReason('');
                            }}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/80">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                              <th className="px-4 py-2 font-medium">Item</th>
                              <th className="px-3 py-2 font-medium">Tx</th>
                              <th className="px-3 py-2 font-medium text-right">Qty</th>
                              <th className="px-3 py-2 font-medium text-right">Unit cost</th>
                              <th className="px-3 py-2 font-medium text-right">Value</th>
                              <th className="px-3 py-2 font-medium">Whse</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.lines.map((r) => (
                              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-2 font-mono font-medium text-slate-700">{r.sage_code}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className="text-[10px]">{r.sage_tx_code}</Badge>
                                  <div className="text-slate-400 text-[10px] mt-0.5">{TX_LABELS[r.sage_tx_code] || ''}</div>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  <span className={Number(r.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}>
                                    {Number(r.quantity) > 0 ? '+' : ''}
                                    {Number(r.quantity).toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">${Number(r.unit_cost).toFixed(4)}</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-700">
                                  ${Number(r.total_value).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    {r.warehouse_code || `ID:${r.warehouse_id}`}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {r.status === 'approved' && r.posted_at
                                    ? 'Posted'
                                    : r.status === 'approved'
                                      ? 'Approved'
                                      : r.status === 'rejected'
                                        ? 'Rejected'
                                        : 'Pending'}
                                  {r.sage_result?.error ? (
                                    <div className="text-red-500 text-[10px] max-w-[140px] truncate" title={r.sage_result.error}>
                                      {r.sage_result.error}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2 text-slate-500 max-w-[220px] truncate" title={r.description || ''}>
                                  {r.description || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!rejectGroup} onOpenChange={(open) => !open && setRejectGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {rejectGroup && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div>
                  <span className="text-slate-500">Event:</span>{' '}
                  <span className="font-medium">{EVENT_LABELS[rejectGroup.event_type] || rejectGroup.event_type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Reference:</span> {rejectGroup.reference || '—'}
                </div>
                <div>
                  <span className="text-slate-500">Lines:</span> {rejectGroup.lineCount} · Value $
                  {rejectGroup.totalValue.toFixed(2)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this entire package is being rejected..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectGroup(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
