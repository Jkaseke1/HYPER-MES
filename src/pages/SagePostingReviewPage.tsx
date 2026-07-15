import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, DollarSign, Package, Building2, Loader2 } from 'lucide-react';
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

const EVENT_LABELS: Record<string, string> = {
  grn_confirmed: 'GRN Receipt',
  materials_issued: 'RM Issue',
  production_completed: 'Batch Complete',
  dispatch_delivered: 'Dispatch',
  macropack_completed: 'Macropack',
  reconciliation_variance_approved: 'Recon Variance',
};

const TX_LABELS: Record<string, string> = {
  GRV: 'Goods Received',
  MFDR: 'Material Issue',
  MFMF: 'Manufacture FG',
  WHT: 'Warehouse Transfer',
  ADJ: 'Adjustment',
};

export default function SagePostingReviewPage() {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<SagePostingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectModal, setRejectModal] = useState<SagePostingReview | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [batchApproving, setBatchApproving] = useState(false);

  const isFinance = profile?.role === 'finance' || profile?.role === 'accountant' || profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sage_posting_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

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

  const handleApprove = async (review: SagePostingReview) => {
    const { error } = await supabase
      .from('sage_posting_reviews')
      .update({
        status: 'approved',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', review.id);

    if (error) {
      toast.error(`Failed to approve: ${error.message}`);
    } else {
      toast.success(`Approved: ${review.sage_code} ${review.sage_tx_code}`);
      fetchData();
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    const { error } = await supabase
      .from('sage_posting_reviews')
      .update({
        status: 'rejected',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rejectModal.id);

    if (error) {
      toast.error(`Failed to reject: ${error.message}`);
    } else {
      toast.success(`Rejected: ${rejectModal.sage_code} ${rejectModal.sage_tx_code}`);
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    }
  };

  const handleBatchApprove = async () => {
    const pending = reviews.filter(r => r.status === 'pending');
    if (pending.length === 0) {
      toast.error('No pending reviews to approve');
      return;
    }

    setBatchApproving(true);
    let successCount = 0;
    for (const review of pending) {
      const { error } = await supabase
        .from('sage_posting_reviews')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', review.id);

      if (!error) successCount++;
    }
    setBatchApproving(false);
    toast.success(`Approved ${successCount} of ${pending.length} transactions`);
    fetchData();
  };

  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length;
  const postedCount = reviews.filter(r => r.posted_at).length;
  const totalValue = reviews.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.total_value), 0);

  const getStatusBadge = (status: string, postedAt: string | null) => {
    if (status === 'approved' && postedAt) {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Posted</Badge>;
    }
    if (status === 'approved') {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Approved — Waiting Post</Badge>;
    }
    if (status === 'rejected') {
      return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Review</Badge>;
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
          <p className="text-sm text-slate-500 mt-1">Review and approve transactions before they post to Sage</p>
        </div>
        {pendingCount > 0 && (
          <Button onClick={handleBatchApprove} disabled={batchApproving} className="bg-emerald-600 hover:bg-emerald-700">
            {batchApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve All ({pendingCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          title="Pending Review"
          value={pendingCount.toString()}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Approved"
          value={approvedCount.toString()}
          icon={CheckCircle2}
          color="blue"
        />
        <StatCard
          title="Posted to Sage"
          value={postedCount.toString()}
          icon={Package}
          color="emerald"
        />
        <StatCard
          title="Rejected"
          value={rejectedCount.toString()}
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="Pending Value"
          value={`$${totalValue.toFixed(2)}`}
          icon={DollarSign}
          color="slate"
        />
      </div>

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Loading reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No {filter !== 'all' ? filter : ''} reviews found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Event</TableHead>
                  <TableHead className="text-xs">Item Code</TableHead>
                  <TableHead className="text-xs">Tx Type</TableHead>
                  <TableHead className="text-xs text-right">Qty (kg)</TableHead>
                  <TableHead className="text-xs text-right">Unit Cost</TableHead>
                  <TableHead className="text-xs text-right">Total Value</TableHead>
                  <TableHead className="text-xs">Whse</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs">
                      <div className="font-medium text-slate-700">{EVENT_LABELS[r.event_type] || r.event_type}</div>
                      <div className="text-slate-400 text-[10px]">{r.event_description}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium text-slate-700">{r.sage_code}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{r.sage_tx_code}</Badge>
                      <div className="text-slate-400 text-[10px] mt-0.5">{TX_LABELS[r.sage_tx_code] || ''}</div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      <span className={Number(r.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {Number(r.quantity) > 0 ? '+' : ''}{Number(r.quantity).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-600">${Number(r.unit_cost).toFixed(4)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-slate-700">${Number(r.total_value).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {r.warehouse_code || `ID:${r.warehouse_id}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">{r.reference || '—'}</TableCell>
                    <TableCell>{getStatusBadge(r.status, r.posted_at)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleApprove(r)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-600 hover:bg-red-50"
                            onClick={() => { setRejectModal(r); setRejectReason(''); }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                      {r.status === 'rejected' && r.rejection_reason && (
                        <div className="text-[10px] text-red-500 max-w-[150px] truncate" title={r.rejection_reason}>
                          {r.rejection_reason}
                        </div>
                      )}
                      {r.status === 'approved' && r.posted_at && r.sage_result?.error && (
                        <div className="text-[10px] text-red-500 max-w-[150px] truncate" title={r.sage_result.error}>
                          Post error: {r.sage_result.error}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectModal} onOpenChange={(open) => !open && setRejectModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {rejectModal && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-slate-500">Item:</span> <span className="font-mono font-medium">{rejectModal.sage_code}</span></div>
                <div><span className="text-slate-500">Tx:</span> {rejectModal.sage_tx_code} — {rejectModal.quantity}kg @ ${rejectModal.unit_cost}/kg</div>
                <div><span className="text-slate-500">Value:</span> ${Number(rejectModal.total_value).toFixed(2)}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this transaction is being rejected..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
