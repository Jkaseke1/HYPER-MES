import { useState, useEffect } from 'react';
import { Scale, Plus, Search, Eye, CheckCircle, Clock, Link as LinkIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { Dialog, DialogContent } from '../components/ui/dialog';
import StatCard from '../components/ui/StatCard';
import WeighBridgeTicket from '../components/grn/WeighBridgeTicket';

interface WBTicket {
  id: string;
  ticket_no: string;
  vehicle_reg: string;
  haulier_code: string;
  driver_name: string;
  driver_id: string;
  product_code: string;
  trailer_number: string;
  time_in: string;
  time_out: string;
  first_mass: number;
  second_mass: number;
  nett_mass: number;
  comment: string;
  driver_signed: boolean;
  status: 'open' | 'linked' | 'cancelled';
  created_at: string;
  grn_number?: string;
}

const emptyWBForm = {
  wb_transaction_no: '',
  wb_vehicle_reg: '',
  wb_haulier_code: 'HYPER',
  wb_product_code: '',
  wb_comment: '',
  wb_trailer_number: '',
  wb_driver_name: '',
  wb_driver_id: '',
  wb_time_in: '',
  wb_first_mass: '',
  wb_time_out: '',
  wb_second_mass: '',
  wb_nett_mass: '',
  wb_driver_signed: false,
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  linked: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function WeighBridgePage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<WBTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<WBTicket | null>(null);
  const [form, setForm] = useState(emptyWBForm);
  const [saving, setSaving] = useState(false);

  async function fetchTickets() {
    setLoading(true);
    const { data, error } = await supabase
      .from('weigh_bridge_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading WB tickets:', error);
      setTickets([]);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchTickets(); }, []);

  function handleFormChange(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.wb_transaction_no) {
      alert('Transaction No is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ticket_no: form.wb_transaction_no,
        vehicle_reg: form.wb_vehicle_reg,
        haulier_code: form.wb_haulier_code,
        driver_name: form.wb_driver_name,
        driver_id: form.wb_driver_id,
        product_code: form.wb_product_code,
        trailer_number: form.wb_trailer_number,
        time_in: form.wb_time_in || null,
        time_out: form.wb_time_out || null,
        first_mass: form.wb_first_mass ? parseFloat(form.wb_first_mass) : null,
        second_mass: form.wb_second_mass ? parseFloat(form.wb_second_mass) : null,
        nett_mass: form.wb_nett_mass ? parseFloat(form.wb_nett_mass) : null,
        comment: form.wb_comment,
        driver_signed: form.wb_driver_signed,
        status: 'open',
        created_by: profile?.id || null,
      };
      const { error } = await supabase.from('weigh_bridge_tickets').insert(payload);
      if (error) throw error;
      setNewOpen(false);
      setForm(emptyWBForm);
      fetchTickets();
    } catch (err: any) {
      alert(`Failed to save ticket: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const filtered = tickets.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.ticket_no?.toLowerCase().includes(q) ||
      t.vehicle_reg?.toLowerCase().includes(q) ||
      t.driver_name?.toLowerCase().includes(q) ||
      t.product_code?.toLowerCase().includes(q)
    );
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const linkedCount = tickets.filter(t => t.status === 'linked').length;
  const todayCount = tickets.filter(t => {
    const d = new Date(t.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weigh Bridge</h1>
          <p className="text-sm text-slate-500 mt-1">Record vehicle weighing before creating a GRN</p>
        </div>
        <button
          onClick={() => { setForm(emptyWBForm); setNewOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New WB Ticket
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Open Tickets" value={openCount} icon={Clock} color="amber" />
        <StatCard title="Linked to GRN" value={linkedCount} icon={LinkIcon} color="teal" />
        <StatCard title="Today" value={todayCount} icon={Scale} color="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticket no, vehicle, driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Scale className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No weigh bridge tickets yet</p>
            <p className="text-xs mt-1">Create a ticket when a vehicle arrives for weighing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  {['Ticket No', 'Vehicle Reg', 'Driver', 'Product', 'Nett Mass (kg)', 'Time In', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-700">{t.ticket_no}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.vehicle_reg || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.driver_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{t.product_code || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                      {t.nett_mass != null ? Number(t.nett_mass).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {t.time_in ? format(new Date(t.time_in), 'dd MMM HH:mm') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[t.status] || ''}`}>
                        {t.status === 'linked' ? (
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Linked to GRN</span>
                        ) : t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewTicket(t)}
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
      </div>

      {/* New Ticket Modal */}
      <Dialog open={newOpen} onOpenChange={() => setNewOpen(false)}>
        <DialogContent className="max-w-[1100px] w-[96vw] max-h-[94vh] p-0 overflow-hidden flex flex-col sm:!max-w-[1100px] [&>button.absolute]:hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex-shrink-0 relative">
            <button
              onClick={() => setNewOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New Weigh Bridge Ticket</h2>
                <p className="text-slate-400 text-xs mt-0.5">Fill in weighing details — link to a GRN after saving</p>
              </div>
            </div>
          </div>
          {/* Body */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
            <div className="p-6">
              <WeighBridgeTicket
                data={form as any}
                onChange={handleFormChange}
                hideHeader
              />
            </div>
            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setNewOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm">
                {saving ? 'Saving...' : 'Save WB Ticket'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Ticket Modal */}
      {viewTicket && (
        <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
          <DialogContent className="max-w-[640px] w-[95vw] p-0 overflow-hidden [&>button.absolute]:hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-6 py-4 relative">
              <button
                onClick={() => setViewTicket(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">WB Ticket #{viewTicket.ticket_no}</h2>
                  <p className="text-teal-200 text-xs mt-0.5">Created {format(new Date(viewTicket.created_at), 'dd MMM yyyy HH:mm')}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Nett Mass Hero */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">1st Mass</p>
                    <p className="text-lg font-bold text-slate-700">{viewTicket.first_mass != null ? Number(viewTicket.first_mass).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'} <span className="text-xs font-normal text-slate-400">kg</span></p>
                  </div>
                  <div className="text-slate-300 text-xl font-light">−</div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">2nd Mass</p>
                    <p className="text-lg font-bold text-slate-700">{viewTicket.second_mass != null ? Number(viewTicket.second_mass).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'} <span className="text-xs font-normal text-slate-400">kg</span></p>
                  </div>
                  <div className="text-slate-300 text-xl font-light">=</div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Nett Mass</p>
                  <p className="text-2xl font-extrabold text-teal-700">{viewTicket.nett_mass != null ? Number(viewTicket.nett_mass).toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'} <span className="text-sm font-normal text-teal-500">kg</span></p>
                </div>
              </div>

              {/* Vehicle & Driver Info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vehicle Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Registration</span>
                      <span className="text-sm font-semibold text-slate-800 font-mono">{viewTicket.vehicle_reg || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Haulier</span>
                      <span className="text-sm font-semibold text-slate-800">{viewTicket.haulier_code || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Trailer No</span>
                      <span className="text-sm font-semibold text-slate-800">{viewTicket.trailer_number || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Product Code</span>
                      <span className="text-sm font-semibold text-slate-800 font-mono">{viewTicket.product_code || '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Driver & Timing</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Driver</span>
                      <span className="text-sm font-semibold text-slate-800">{viewTicket.driver_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Driver ID</span>
                      <span className="text-sm font-semibold text-slate-800 font-mono">{viewTicket.driver_id || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Time In</span>
                      <span className="text-sm font-semibold text-slate-800">{viewTicket.time_in ? format(new Date(viewTicket.time_in), 'dd MMM HH:mm') : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Time Out</span>
                      <span className="text-sm font-semibold text-slate-800">{viewTicket.time_out ? format(new Date(viewTicket.time_out), 'dd MMM HH:mm') : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment */}
              {viewTicket.comment && (
                <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Comment</p>
                  <p className="text-sm text-slate-700">{viewTicket.comment}</p>
                </div>
              )}

              {/* Footer: Status + GRN Link */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[viewTicket.status]}`}>
                  {viewTicket.status === 'linked' ? (
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Linked{viewTicket.grn_number ? ` — ${viewTicket.grn_number}` : ''}</span>
                  ) : viewTicket.status}
                </span>
                <span className="text-xs text-slate-400">{viewTicket.driver_signed ? '✓ Driver signed' : 'Not signed'}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
