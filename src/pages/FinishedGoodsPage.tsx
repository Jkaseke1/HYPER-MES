import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const WHSE_NAMES: Record<number, string> = {
  18: 'Raw Materials',
  19: 'Production',
  20: 'Finished Goods',
  21: 'Mutare Warehouse',
  17: 'DEB',
};

const EVENT_LABELS: Record<string, string> = {
  production_completed: 'Batch Complete',
  dispatch_delivered: 'Dispatch',
  materials_issued: 'Material Issue',
  grn_confirmed: 'GRN',
  rm_cost_updated: 'RM Cost',
  macropack_manufactured: 'Macropack',
  reconciliation_variance_approved: 'Reconciliation',
};

function fmt(n: number) {
  if (n === 0) return '0';
  return n.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function whseName(id: number, fallback?: string) {
  return WHSE_NAMES[id] || fallback || `Whse ${id}`;
}

type StockRow = any;
type MovementRow = any;

export default function FinishedGoodsPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    const [stockRes, moveRes] = await Promise.all([
      supabase
        .from('v_sage_stock_for_validation')
        .select('*')
        .is('raw_material_id', null)
        .order('raw_material_name'),
      supabase
        .from('sage_posting_reviews')
        .select('*')
        .not('posted_at', 'is', null)
        .order('posted_at', { ascending: false })
        .limit(200),
    ]);
    setStock(stockRes.data || []);
    setMovements(moveRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const codes = useMemo(() => {
    const s = new Set<string>();
    stock.forEach((r) => s.add(r.sage_code));
    movements.forEach((m) => s.add(m.sage_code));
    return Array.from(s).sort();
  }, [stock, movements]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(movements.map((m) => m.event_type))).sort();
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (selectedCode !== 'all' && m.sage_code !== selectedCode) return false;
      if (eventFilter !== 'all' && m.event_type !== eventFilter) return false;
      return true;
    });
  }, [movements, selectedCode, eventFilter]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-7 h-7 text-teal-600" />
              Finished Goods & Transfers
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              FG stock per warehouse and the Sage movements that created the transfers.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-60 transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stock summary */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-slate-800">Finished Goods Stock</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-left px-4 py-2 font-medium">Sage Code</th>
                  <th className="text-right px-4 py-2 font-medium">Whse ID</th>
                  <th className="text-left px-4 py-2 font-medium">Warehouse</th>
                  <th className="text-right px-4 py-2 font-medium">Quantity (kg)</th>
                  <th className="text-left px-4 py-2 font-medium">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      {loading ? 'Loading…' : 'No finished goods stock found.'}
                    </td>
                  </tr>
                ) : (
                  stock.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{row.raw_material_name || '—'}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{row.sage_code}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.warehouse_id}</td>
                      <td className="px-4 py-2 text-slate-700">{whseName(row.warehouse_id, row.warehouse_name)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">{fmt(Number(row.sage_quantity || 0))}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {row.last_synced_at ? format(new Date(row.last_synced_at), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Movements */}
        <section className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-slate-800">Sage Movements / Transfers</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              >
                <option value="all">All sage codes</option>
                {codes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              >
                <option value="all">All events</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Posted</th>
                  <th className="text-left px-4 py-2 font-medium">Event</th>
                  <th className="text-left px-4 py-2 font-medium">Sage Code</th>
                  <th className="text-left px-4 py-2 font-medium">Tx</th>
                  <th className="text-right px-4 py-2 font-medium">Qty (kg)</th>
                  <th className="text-left px-4 py-2 font-medium">Warehouse</th>
                  <th className="text-left px-4 py-2 font-medium">Reference</th>
                  <th className="text-left px-4 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                      {loading ? 'Loading…' : 'No posted movements match the filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">
                        {m.posted_at ? format(new Date(m.posted_at), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{EVENT_LABELS[m.event_type] || m.event_type}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{m.sage_code}</td>
                      <td className="px-4 py-2 font-mono text-slate-700">{m.sage_tx_code}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {m.quantity > 0 ? `+${fmt(Number(m.quantity))}` : fmt(Number(m.quantity))}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{whseName(m.warehouse_id, m.warehouse_code)}</td>
                      <td className="px-4 py-2 font-mono text-slate-500">{m.reference || '—'}</td>
                      <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={m.description || ''}>
                        {m.description || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
