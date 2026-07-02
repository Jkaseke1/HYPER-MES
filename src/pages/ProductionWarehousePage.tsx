import { useState, useEffect, useMemo } from 'react';
import { Boxes, Search, RefreshCw, AlertTriangle, TrendingDown, Package, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import StatCard from '../components/ui/StatCard';

interface TransferRow {
  id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  movement_date: string;
  batch_number: string;
  notes: string;
  created_at: string;
  raw_materials?: { name: string; code: string; unit: string };
}

interface AggregatedMaterial {
  raw_material_id: string;
  name: string;
  code: string;
  unit: string;
  net_available: number;
  last_transfer: string;
  transfer_count: number;
  transfers: TransferRow[];
}

export default function ProductionWarehousePage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchTransfers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, raw_material_id, quantity, unit, movement_date, batch_number, notes, created_at, raw_materials(name, code, unit)')
      .eq('movement_type', 'production_input')
      .order('created_at', { ascending: false });
    if (error) console.error('Failed to load production warehouse:', error);
    setTransfers((data as any) || []);
    setLastRefresh(new Date());
    setLoading(false);
  }

  useEffect(() => { fetchTransfers(); }, []);

  const aggregated = useMemo<AggregatedMaterial[]>(() => {
    const map: Record<string, AggregatedMaterial> = {};
    for (const t of transfers) {
      const id = t.raw_material_id;
      if (!map[id]) {
        map[id] = {
          raw_material_id: id,
          name: (t.raw_materials as any)?.name || 'Unknown',
          code: (t.raw_materials as any)?.code || '',
          unit: (t.raw_materials as any)?.unit || t.unit,
          net_available: 0,
          last_transfer: t.movement_date || t.created_at,
          transfer_count: 0,
          transfers: [],
        };
      }
      map[id].net_available += Number(t.quantity || 0);
      map[id].transfer_count += 1;
      map[id].transfers.push(t);
      if ((t.movement_date || t.created_at) > map[id].last_transfer) {
        map[id].last_transfer = t.movement_date || t.created_at;
      }
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [transfers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return aggregated;
    const q = search.toLowerCase();
    return aggregated.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [aggregated, search]);

  const totalMaterials = aggregated.length;
  const totalQty = aggregated.reduce((s, m) => s + Math.max(0, m.net_available), 0);
  const recentCount = aggregated.filter(m => {
    const d = new Date(m.last_transfer);
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production Warehouse</h1>
          <p className="text-sm text-slate-500 mt-1">Raw materials transferred to the production floor — visible to production team</p>
        </div>
        <button
          onClick={fetchTransfers}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Materials on Floor" value={totalMaterials} icon={Boxes} color="teal" />
        <StatCard title="Net Qty on Floor" value={`${totalQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} icon={Package} color="blue" />
        <StatCard title="Transfers (last 7 days)" value={recentCount} icon={TrendingDown} color="emerald" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          This view shows <strong>net available quantity</strong> on the production floor from `production_input` movements 
          (transfers in minus issues out). For exact lot-level stock, use <strong>RM Warehouse / Inventory</strong>.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <p className="text-xs text-slate-400 ml-4">Last refreshed: {format(lastRefresh, 'HH:mm:ss')}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Boxes className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No materials found on production floor</p>
            <p className="text-xs mt-1">Create a Material Transfer to move stock from RM warehouse to production</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(m => (
              <div key={m.raw_material_id}>
                <button
                  className="w-full flex items-center px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setExpanded(expanded === m.raw_material_id ? null : m.raw_material_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{m.code}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm mr-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-800">{Math.max(0, m.net_available).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-400">{m.unit}</span></p>
                      <p className="text-xs text-slate-400">Net on floor</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-slate-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(m.last_transfer), 'dd MMM yyyy')}</p>
                      <p className="text-xs text-slate-400">Last transfer</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-medium text-slate-600">{m.transfer_count}</p>
                      <p className="text-xs text-slate-400">Transfers</p>
                    </div>
                  </div>
                  <span className={`text-slate-300 text-lg transition-transform ${expanded === m.raw_material_id ? 'rotate-90' : ''}`}>›</span>
                </button>

                {expanded === m.raw_material_id && (
                  <div className="px-4 pb-4 bg-slate-50/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 px-3 font-semibold text-slate-500">Date</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Batch</th>
                          <th className="py-2 px-3 font-semibold text-slate-500 text-right">Qty</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Purpose / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {m.transfers.map(t => (
                          <tr key={t.id} className="hover:bg-white">
                            <td className="py-2 px-3 text-slate-600">{t.movement_date ? format(new Date(t.movement_date), 'dd MMM yyyy') : '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{t.batch_number || '-'}</td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700">{Number(t.quantity).toLocaleString()} {t.unit}</td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-xs">{t.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">{filtered.length} material{filtered.length !== 1 ? 's' : ''} on production floor</p>
        </div>
      </div>
    </div>
  );
}
