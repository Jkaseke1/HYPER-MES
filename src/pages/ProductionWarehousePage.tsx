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
  mes_ledger_quantity: number;
  sage_pd_quantity: number | null;
  sage_pd_synced_at: string | null;
  last_transfer: string;
  transfer_count: number;
  transfers: TransferRow[];
}

import { ArrowRightLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PendingTransfer {
  id: string;
  transfer_number: string;
  quantity: number;
  unit: string;
  status: string;
  created_at: string;
  raw_materials?: { name: string; code: string };
}

export default function ProductionWarehousePage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [sageProductionBalances, setSageProductionBalances] = useState<Record<string, { quantity: number; syncedAt: string | null }>>({});
  const [pendingAcceptanceTransfers, setPendingAcceptanceTransfers] = useState<PendingTransfer[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchTransfers(silent = false) {
    if (!silent) setLoading(true);
    const [
      { data: smData, error: smError },
      { data: wbData, error: wbError },
      { data: sagePdData, error: sagePdError },
      { data: pendingData, error: pendingError }
    ] = await Promise.all([
      supabase
        .from('stock_movements')
        .select('id, raw_material_id, quantity, unit, movement_date, batch_number, notes, created_at, raw_materials(name, code, unit)')
        .eq('movement_type', 'production_input')
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_stock_balances')
        .select('raw_material_id, quantity, warehouses!inner(code)')
        .eq('warehouses.code', 'PRODUCTION'),
      supabase
        .from('sage_stock_balances')
        .select('raw_material_id, quantity, last_synced_at')
        .eq('warehouse_id', 19),
      supabase
        .from('material_transfers')
        .select('id, transfer_number, quantity, unit, status, created_at, raw_materials(name, code)')
        .in('status', ['in_buffer', 'pending'])
        .order('created_at', { ascending: false }),
    ]);
    if (smError) console.error('Failed to load production movements:', smError);
    if (wbError) console.error('Failed to load production balances:', wbError);
    if (sagePdError) console.error('Failed to load Sage Production balances:', sagePdError);
    if (pendingError) console.error('Failed to load pending transfers:', pendingError);

    setTransfers((smData as any) || []);
    setPendingAcceptanceTransfers((pendingData as any) || []);
    const balMap: Record<string, number> = {};
    (wbData as any || []).forEach((b: any) => {
      balMap[b.raw_material_id] = Number(b.quantity || 0);
    });
    setBalances(balMap);
    const sagePdMap: Record<string, { quantity: number; syncedAt: string | null }> = {};
    (sagePdData as any || []).forEach((balance: any) => {
      sagePdMap[balance.raw_material_id] = {
        quantity: Number(balance.quantity || 0),
        syncedAt: balance.last_synced_at || null,
      };
    });
    setSageProductionBalances(sagePdMap);
    setLastRefresh(new Date());
    if (!silent) setLoading(false);
  }

  async function handleAcceptToProduction(transferId: string) {
    setAcceptingId(transferId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('approve_material_transfer_to_production', {
        p_transfer_id: transferId,
        p_approved_by: user.id,
      });

      if (error) throw error;

      await fetchTransfers(true);
    } catch (err: any) {
      alert(`Failed to receive into Production Warehouse: ${err?.message || 'Please try again'}`);
    } finally {
      setAcceptingId(null);
    }
  }

  useEffect(() => { fetchTransfers(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('production-warehouse-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
        fetchTransfers(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sage_stock_balances' }, () => {
        fetchTransfers(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock_balances' }, () => {
        fetchTransfers(true);
      })
      .subscribe();

    const intervalId = window.setInterval(() => {
      fetchTransfers(true);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

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
          mes_ledger_quantity: 0,
          sage_pd_quantity: null,
          sage_pd_synced_at: null,
          last_transfer: t.movement_date || t.created_at,
          transfer_count: 0,
          transfers: [],
        };
      }
      map[id].mes_ledger_quantity += Number(t.quantity || 0);
      map[id].transfer_count += 1;
      map[id].transfers.push(t);
      if ((t.movement_date || t.created_at) > map[id].last_transfer) {
        map[id].last_transfer = t.movement_date || t.created_at;
      }
    }
    for (const [id, m] of Object.entries(map)) {
      if (balances[id] !== undefined) {
        map[id].mes_ledger_quantity = balances[id];
      }
      if (sageProductionBalances[id] !== undefined) {
        map[id].sage_pd_quantity = sageProductionBalances[id].quantity;
        map[id].sage_pd_synced_at = sageProductionBalances[id].syncedAt;
      }
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [transfers, balances, sageProductionBalances]);

  const filtered = useMemo(() => {
    if (!search.trim()) return aggregated;
    const q = search.toLowerCase();
    return aggregated.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [aggregated, search]);

  const totalMaterials = aggregated.length;
  const totalMesLedgerQty = aggregated.reduce((sum, material) => sum + Math.max(0, material.mes_ledger_quantity), 0);
  const totalSagePdQty = aggregated.reduce((sum, material) => sum + Math.max(0, material.sage_pd_quantity || 0), 0);
  const lastSagePdSync = aggregated.reduce<string | null>((latest, material) => {
    if (!material.sage_pd_synced_at) return latest;
    if (!latest || new Date(material.sage_pd_synced_at) > new Date(latest)) return material.sage_pd_synced_at;
    return latest;
  }, null);
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
          onClick={() => fetchTransfers()}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* PENDING MATERIAL TRANSFERS TO ACCEPT INTO PRODUCTION WAREHOUSE */}
      {pendingAcceptanceTransfers.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 text-white shadow-lg border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ArrowRightLeft className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  🚨 Pending Material Transfer Receipts ({pendingAcceptanceTransfers.length})
                </h3>
                <p className="text-xs text-slate-300">
                  Materials transferred from RM Warehouse sitting in Holding Bay — accept into Production WH 19
                </p>
              </div>
            </div>
            <Link
              to="/material-transfer"
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline"
            >
              Open Full Transfer Hub ➔
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingAcceptanceTransfers.map(pt => (
              <div key={pt.id} className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{pt.transfer_number}</span>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">In Holding Bay</span>
                  </div>
                  <h4 className="font-bold text-sm text-white mt-1.5">{pt.raw_materials?.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">Code: {pt.raw_materials?.code}</p>
                  <p className="text-sm font-extrabold text-white mt-1">
                    Qty: <span className="text-emerald-400 font-mono">{pt.quantity.toLocaleString()} {pt.unit}</span>
                  </p>
                </div>
                <button
                  disabled={acceptingId === pt.id}
                  onClick={() => handleAcceptToProduction(pt.id)}
                  className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg text-xs font-extrabold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {acceptingId === pt.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Receive into WH 19
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Materials on Floor" value={totalMaterials} icon={Boxes} color="teal" />
        <StatCard title="Sage PD Available" value={`${totalSagePdQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} icon={Package} color="emerald" />
        <StatCard title="MES Floor Ledger" value={`${totalMesLedgerQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} icon={Package} color="blue" />
        <StatCard title="Transfers (last 7 days)" value={recentCount} icon={TrendingDown} color="emerald" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          <strong>Sage PD Available</strong> is the primary Sage warehouse 19 total and updates when the bridge completes a stock sync.
          <strong> MES Floor Ledger</strong> is an internal operational reconciliation total. Last Sage PD sync: {lastSagePdSync ? format(new Date(lastSagePdSync), 'dd MMM yyyy HH:mm:ss') : 'awaiting first sync'}.
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
          <p className="text-xs text-slate-400 ml-4">Live view refreshed: {format(lastRefresh, 'HH:mm:ss')}</p>
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
                      <p className="font-semibold text-emerald-700">{m.sage_pd_quantity === null ? 'Not synced' : `${m.sage_pd_quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${m.unit}`}</p>
                      <p className="text-xs text-slate-400">Sage PD {m.sage_pd_synced_at ? format(new Date(m.sage_pd_synced_at), 'dd MMM HH:mm:ss') : ''}</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="font-semibold text-slate-800">{Math.max(0, m.mes_ledger_quantity).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-400">{m.unit}</span></p>
                      <p className="text-xs text-slate-400">MES floor ledger</p>
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
