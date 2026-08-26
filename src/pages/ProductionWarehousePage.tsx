import { useState, useEffect, useMemo } from 'react';
import { Boxes, Search, RefreshCw, AlertTriangle, TrendingDown, Package, Calendar, ArrowRightLeft, CheckCircle2, Loader2, Truck, UserRound, ClipboardList, X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import StatCard from '../components/ui/StatCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';

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
  production_reorder_level: number;
}

interface ProductionMaterialSetting { id: string; name: string; code: string; unit: string; reorder_level: number; production_reorder_level?: number; }

import { Link } from 'react-router-dom';

interface PendingTransfer {
  id: string;
  transfer_number: string;
  quantity: number;
  unit: string;
  status: string;
  created_at: string;
  purpose?: string;
  notes?: string;
  requester?: { full_name?: string | null } | null;
  raw_materials?: { name: string; code: string; unit?: string };
}

type ReceiptNotice = { tone: 'success' | 'error'; message: string } | null;

export default function ProductionWarehousePage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [sageProductionBalances, setSageProductionBalances] = useState<Record<string, { quantity: number; syncedAt: string | null }>>({});
  const [pendingAcceptanceTransfers, setPendingAcceptanceTransfers] = useState<PendingTransfer[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [receiptToConfirm, setReceiptToConfirm] = useState<PendingTransfer | null>(null);
  const [receiptNotice, setReceiptNotice] = useState<ReceiptNotice>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [materialSettings, setMaterialSettings] = useState<ProductionMaterialSetting[]>([]);
  const [thresholdDraft, setThresholdDraft] = useState<Record<string, string>>({});
  const [lastAlertSignature, setLastAlertSignature] = useState('');

  async function fetchTransfers(silent = false) {
    if (!silent) setLoading(true);
    const [
      { data: smData, error: smError },
      { data: wbData, error: wbError },
      { data: sagePdData, error: sagePdError },
      { data: pendingData, error: pendingError },
      { data: settingsData, error: settingsError }
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
        .select('id, transfer_number, quantity, unit, status, purpose, notes, created_at, requester:profiles!requested_by(full_name), raw_materials(name, code, unit)')
        .eq('status', 'in_buffer')
        .order('created_at', { ascending: false }),
      supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
    ]);
    if (smError) console.error('Failed to load production movements:', smError);
    if (wbError) console.error('Failed to load production balances:', wbError);
    if (sagePdError) console.error('Failed to load Sage Production balances:', sagePdError);
    if (pendingError) console.error('Failed to load pending transfers:', pendingError);
    if (settingsError) console.error('Failed to load production stock thresholds:', settingsError);

    setTransfers((smData as any) || []);
    setPendingAcceptanceTransfers((pendingData as any) || []);
    setMaterialSettings((settingsData as ProductionMaterialSetting[]) || []);
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

  async function handleAcceptToProduction(transfer: PendingTransfer) {
    setAcceptingId(transfer.id);
    setReceiptNotice(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('approve_material_transfer_to_production', {
        p_transfer_id: transfer.id,
        p_approved_by: user.id,
      });

      if (error) throw error;

      setReceiptToConfirm(null);
      setReceiptNotice({
        tone: 'success',
        message: `${transfer.raw_materials?.name || 'Material'} received into Production Warehouse.`,
      });
      await fetchTransfers(true);
    } catch (err: any) {
      setReceiptNotice({
        tone: 'error',
        message: err?.message || 'The transfer could not be received. Please try again.',
      });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_transfers' }, () => {
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
          production_reorder_level: 0,
        };
      }
      map[id].mes_ledger_quantity += Number(t.quantity || 0);
      map[id].transfer_count += 1;
      map[id].transfers.push(t);
      if ((t.movement_date || t.created_at) > map[id].last_transfer) {
        map[id].last_transfer = t.movement_date || t.created_at;
      }
    }
    for (const setting of materialSettings) {
      const threshold = Number(setting.production_reorder_level ?? setting.reorder_level ?? 0);
      if (!map[setting.id]) {
        map[setting.id] = { raw_material_id: setting.id, name: setting.name, code: setting.code, unit: setting.unit, mes_ledger_quantity: 0, sage_pd_quantity: 0, sage_pd_synced_at: null, last_transfer: new Date(0).toISOString(), transfer_count: 0, transfers: [], production_reorder_level: threshold };
      } else {
        map[setting.id].production_reorder_level = threshold;
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
  }, [transfers, balances, sageProductionBalances, materialSettings]);

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
  const pendingReceiptQuantity = pendingAcceptanceTransfers.reduce((sum, transfer) => sum + Number(transfer.quantity || 0), 0);
  const stockHealth = useMemo(() => {
    const critical = aggregated.filter((m) => m.production_reorder_level > 0 && Number(m.sage_pd_quantity || 0) === 0);
    const low = aggregated.filter((m) => m.production_reorder_level > 0 && Number(m.sage_pd_quantity || 0) > 0 && Number(m.sage_pd_quantity || 0) <= m.production_reorder_level);
    return { critical, low, healthy: aggregated.length - critical.length - low.length };
  }, [aggregated]);

  useEffect(() => {
    const signature = [...stockHealth.critical, ...stockHealth.low].map((m) => `${m.raw_material_id}:${m.sage_pd_quantity}`).join('|');
    if (signature && signature !== lastAlertSignature) toast.error(`${stockHealth.critical.length ? `${stockHealth.critical.length} critical, ` : ''}${stockHealth.low.length} low Production stock alert${stockHealth.low.length === 1 ? '' : 's'} need attention.`, { duration: 7000 });
    setLastAlertSignature(signature);
  }, [stockHealth, lastAlertSignature]);

  async function saveProductionThreshold(materialId: string, value: string) {
    const threshold = Math.max(0, Number(value || 0));
    const { error } = await supabase.from('raw_materials').update({ production_reorder_level: threshold }).eq('id', materialId);
    if (error) {
      // Older UAT databases do not yet have the separate Production threshold
      // column. Keep the control usable by persisting the established shared
      // reorder level until that additive migration is applied.
      const missingProductionThresholdColumn = error.code === 'PGRST204'
        || /production_reorder_level|column/i.test(error.message || '');
      if (!missingProductionThresholdColumn) return toast.error('Could not save the Production threshold. Please try again.');

      const { error: fallbackError } = await supabase
        .from('raw_materials')
        .update({ reorder_level: threshold })
        .eq('id', materialId);
      if (fallbackError) return toast.error('Could not save the stock threshold. Please try again.');

      setMaterialSettings((items) => items.map((item) => item.id === materialId
        ? { ...item, reorder_level: threshold, production_reorder_level: threshold }
        : item));
      toast.success('Production minimum saved using the current shared reorder level.');
      return;
    }
    setMaterialSettings((items) => items.map((item) => item.id === materialId ? { ...item, production_reorder_level: threshold } : item));
    toast.success('Production threshold saved.');
  }

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

      {receiptNotice && (
        <div className={`flex items-start justify-between gap-4 border px-4 py-3 text-sm ${receiptNotice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
          <div className="flex items-start gap-2">
            {receiptNotice.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span className="font-medium">{receiptNotice.message}</span>
          </div>
          <button type="button" onClick={() => setReceiptNotice(null)} className="text-current/60 hover:text-current" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Live RM inbox for Production receiving */}
      {pendingAcceptanceTransfers.length > 0 && (
        <section className="border border-teal-200 bg-teal-50/70">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-teal-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-teal-200 bg-teal-100 text-teal-700">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Incoming from Raw Materials</h2>
                  <span className="border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700">{pendingAcceptanceTransfers.length} ready</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">Confirm physical receipt from the Holding Bay into Production Warehouse 19.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-slate-900">{pendingReceiptQuantity.toLocaleString()} kg</p>
                <p className="text-xs font-medium text-slate-500">awaiting receipt</p>
              </div>
            <Link
              to="/material-transfer"
              className="text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              Transfer history
            </Link>
          </div>
          </div>

          <div className="divide-y divide-teal-100 px-5">
            {pendingAcceptanceTransfers.map(pt => (
              <div key={pt.id} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-600">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{pt.raw_materials?.name || 'Raw material'}</p>
                      <span className="font-mono text-xs text-slate-500">{pt.raw_materials?.code || 'No code'}</span>
                      <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Holding Bay</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><ArrowRightLeft className="h-3.5 w-3.5 text-teal-600" /> RM Warehouse to Production</span>
                      <span className="font-mono">{pt.transfer_number}</span>
                      <span>{format(new Date(pt.created_at), 'dd MMM, HH:mm')}</span>
                      {pt.requester?.full_name && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {pt.requester.full_name}</span>}
                      {pt.purpose && <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> {pt.purpose}</span>}
                    </div>
                    </div>
                </div>
                <div className="border-l border-teal-200 pl-4 text-right">
                  <p className="font-mono text-lg font-bold text-slate-900">{Number(pt.quantity).toLocaleString()}</p>
                  <p className="text-xs font-medium text-slate-500">{pt.unit}</p>
                </div>
                <button
                  disabled={acceptingId === pt.id}
                  onClick={() => setReceiptToConfirm(pt)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
                >
                  {acceptingId === pt.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Receiving
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Receive into Production
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {receiptToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="receive-transfer-title">
          <div className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-teal-700">Production receipt</p>
                <h2 id="receive-transfer-title" className="mt-1 text-lg font-bold text-slate-900">Receive material into Production?</h2>
              </div>
              <button type="button" onClick={() => setReceiptToConfirm(null)} disabled={acceptingId === receiptToConfirm.id} className="text-slate-400 hover:text-slate-700" aria-label="Close receipt confirmation"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-5 text-sm">
              <div className="flex items-center justify-between gap-4 border-l-4 border-teal-600 bg-teal-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{receiptToConfirm.raw_materials?.name}</p>
                  <p className="font-mono text-xs text-slate-500">{receiptToConfirm.transfer_number} · {receiptToConfirm.raw_materials?.code}</p>
                </div>
                <p className="font-mono text-lg font-bold text-teal-800">{Number(receiptToConfirm.quantity).toLocaleString()} {receiptToConfirm.unit}</p>
              </div>
              <p className="leading-6 text-slate-600">This confirms the physical handover from the Holding Bay and makes the material available in Production Warehouse 19.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setReceiptToConfirm(null)} disabled={acceptingId === receiptToConfirm.id} className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => handleAcceptToProduction(receiptToConfirm)} disabled={acceptingId === receiptToConfirm.id} className="inline-flex items-center gap-2 bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                {acceptingId === receiptToConfirm.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm receipt
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Materials on Floor" value={totalMaterials} icon={Boxes} color="teal" />
        <StatCard title="Sage PD Available" value={`${totalSagePdQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} icon={Package} color="emerald" />
        <StatCard title="MES Floor Ledger" value={`${totalMesLedgerQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} icon={Package} color="blue" />
        <StatCard title="Transfers (last 7 days)" value={recentCount} icon={TrendingDown} color="emerald" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`border p-5 ${stockHealth.critical.length ? 'border-rose-200 bg-rose-50' : stockHealth.low.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Production floor replenishment</p><h2 className="mt-1 text-lg font-bold text-slate-900">{stockHealth.critical.length ? 'Material handover needed now' : stockHealth.low.length ? 'Production stock is nearing minimum' : 'Production stock position healthy'}</h2><p className="mt-1 text-sm text-slate-600">Production has its own minimum levels, separate from RM warehouse thresholds.</p></div><AlertTriangle className={`h-6 w-6 shrink-0 ${stockHealth.critical.length ? 'text-rose-600' : stockHealth.low.length ? 'text-amber-600' : 'text-emerald-600'}`} /></div>{(stockHealth.critical.length || stockHealth.low.length) > 0 && <div className="mt-4 flex flex-wrap gap-2">{[...stockHealth.critical, ...stockHealth.low].slice(0, 6).map((m) => <span key={m.raw_material_id} className="border border-white bg-white px-2 py-1 text-xs font-semibold text-slate-700">{m.name}: {Number(m.sage_pd_quantity || 0).toLocaleString()} / {m.production_reorder_level.toLocaleString()} {m.unit}</span>)}</div>}</div>
        <div className="border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Floor stock health</p><div className="mt-2 h-32"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Healthy', value: Math.max(0, stockHealth.healthy) }, { name: 'Low', value: stockHealth.low.length }, { name: 'Critical', value: stockHealth.critical.length }]} dataKey="value" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={3}><Cell fill="#10b981" /><Cell fill="#f59e0b" /><Cell fill="#ef4444" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex justify-between text-[11px] text-slate-500"><span>Healthy {stockHealth.healthy}</span><span>Low {stockHealth.low.length}</span><span>Critical {stockHealth.critical.length}</span></div></div>
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
                    <div className="hidden lg:block" onClick={(event) => event.stopPropagation()}>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Floor minimum</label>
                      <div className="mt-1 flex items-center gap-1"><SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" /><input type="number" min="0" step="0.01" value={thresholdDraft[m.raw_material_id] ?? String(m.production_reorder_level || '')} onChange={(event) => setThresholdDraft((draft) => ({ ...draft, [m.raw_material_id]: event.target.value }))} onBlur={(event) => saveProductionThreshold(m.raw_material_id, event.target.value)} className="w-20 border border-slate-200 bg-white px-1.5 py-1 text-right font-mono text-xs text-slate-700 focus:border-teal-500 focus:outline-none" /><span className="text-[10px] text-slate-400">{m.unit}</span></div>
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
