import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Package, TrendingDown, AlertTriangle, ExternalLink, Activity, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatCard from '../components/ui/StatCard';
import type { ReconProduction } from '../types/reconciliation';
import { MONTH_NAMES } from '../types/reconciliation';

interface Branch {
  id: string;
  name: string;
}

interface PeriodInfo {
  id: string;
  month: number;
  year: number;
  status: string;
  branches?: { name: string };
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  feeds: 'Feed Products',
  blocks: 'Block Products',
  chunks: 'Chunks Products',
  other: 'Other Products',
};

const PRODUCT_TYPES = ['feeds', 'blocks', 'chunks', 'other'];

function VariancePill({ value }: { value: number }) {
  if (value === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">0</span>;
  if (value > 0) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">+{value.toLocaleString()}</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{value.toLocaleString()}</span>;
}

function VarPctPill({ value }: { value: number }) {
  if (Math.abs(value) < 0.01) return <span className="text-xs text-emerald-600 font-medium">0.00%</span>;
  if (value > 0) return <span className="text-xs font-medium text-emerald-600">+{value.toFixed(2)}%</span>;
  return <span className="text-xs font-medium text-red-600">{value.toFixed(2)}%</span>;
}

export default function ProductionReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [rows, setRows] = useState<ReconProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    supabase.from('branches').select('id, name').order('name').then(({ data }) => {
      setBranches(data || []);
    });
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      let query = supabase
        .from('reconciliation_periods')
        .select('id, month, year, status, branches(name)')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      if (selectedBranch) query = query.eq('branch_id', selectedBranch);

      const { data: periods } = await query.order('created_at', { ascending: false }).limit(1);
      const found = periods?.[0] as PeriodInfo | undefined;
      setPeriod(found || null);

      if (!found) {
        setRows([]);
        setLoading(false);
        setLastRefresh(new Date());
        return;
      }

      const { data: prod } = await supabase
        .from('recon_production')
        .select('*')
        .eq('period_id', found.id)
        .order('product_name');

      setRows((prod || []) as ReconProduction[]);
    } catch (err) {
      console.error('Error fetching Production report:', err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear, selectedBranch]);

  const totals = rows.reduce((acc, r) => ({
    opening: acc.opening + r.opening_stock,
    received: acc.received + r.stock_received,
    total: acc.total + r.total,
    expected: acc.expected + r.expected_production,
    actual: acc.actual + r.actual_production,
    wastage: acc.wastage + r.wastage,
    closing: acc.closing + r.closing_stock,
    physical: acc.physical + r.physical_stock,
    system: acc.system + r.system_stock,
    variance: acc.variance + r.material_variance,
  }), { opening: 0, received: 0, total: 0, expected: 0, actual: 0, wastage: 0, closing: 0, physical: 0, system: 0, variance: 0 });

  const completionRate = totals.expected > 0 ? (totals.actual / totals.expected) * 100 : 0;

  const exportToCSV = () => {
    const headers = ['Type', 'Product', 'Opening', 'Received', 'Total', 'Expected', 'Actual', 'Wastage', 'Closing', 'Physical', 'System', 'Variance', 'Var %', 'Comments'];
    const csvRows = rows.map(r => [
      r.product_type, r.product_name, r.opening_stock, r.stock_received, r.total,
      r.expected_production, r.actual_production, r.wastage, r.closing_stock,
      r.physical_stock, r.system_stock, r.material_variance, `${r.variance_pct.toFixed(2)}%`,
      r.comments || ''
    ]);
    const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-report-${MONTH_NAMES[selectedMonth - 1]}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function SectionTable({ sectionRows, title }: { sectionRows: ReconProduction[]; title: string }) {
    if (sectionRows.length === 0) return null;
    const t = sectionRows.reduce((acc, r) => ({
      opening: acc.opening + r.opening_stock,
      received: acc.received + r.stock_received,
      total: acc.total + r.total,
      expected: acc.expected + r.expected_production,
      actual: acc.actual + r.actual_production,
      wastage: acc.wastage + r.wastage,
      closing: acc.closing + r.closing_stock,
      physical: acc.physical + r.physical_stock,
      system: acc.system + r.system_stock,
      variance: acc.variance + r.material_variance,
    }), { opening: 0, received: 0, total: 0, expected: 0, actual: 0, wastage: 0, closing: 0, physical: 0, system: 0, variance: 0 });

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[180px]">Product</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Opening</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Received</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Expected</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Wastage</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Closing</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Physical (T)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">System (T)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Var %</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectionRows.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 ${item.material_variance < 0 ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.product_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.opening_stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{item.stock_received.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{item.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.expected_production.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-teal-700">{item.actual_production.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{item.wastage.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.closing_stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{item.physical_stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.system_stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right"><VariancePill value={item.material_variance} /></td>
                  <td className="px-4 py-3 text-right"><VarPctPill value={item.variance_pct} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[120px] truncate">{item.comments}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold text-slate-700">
                <td className="px-4 py-3">TOTALS</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.opening.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{t.received.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.total.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.expected.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-teal-700">{t.actual.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-700">{t.wastage.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.closing.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.physical.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.system.toLocaleString()}</td>
                <td className="px-4 py-3 text-right"><VariancePill value={t.variance} /></td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {period
              ? `${MONTH_NAMES[period.month - 1]} ${period.year} · ${period.branches?.name ?? 'All Branches'} · Status: ${period.status}`
              : 'Reconciliation-based production output report'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Refreshed {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={exportToCSV} disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-600">Month:</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Year:</label>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {branches.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Branch:</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500">
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
        </div>
      )}

      {/* No period found */}
      {!loading && !period && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-10 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-base font-semibold text-amber-800">No reconciliation period found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
          <p className="text-sm text-amber-600 mt-1">Create a reconciliation period first, then enter production data.</p>
          <a href="/reconciliation" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors">
            <ExternalLink className="w-4 h-4" /> Go to Reconciliation
          </a>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && period && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Products" value={rows.length.toString()} icon={Package} color="teal" />
          <StatCard title="Actual Production" value={totals.actual.toLocaleString() + ' T'} icon={Activity} color="emerald" />
          <StatCard title="Total Wastage" value={totals.wastage.toLocaleString() + ' T'} icon={TrendingDown} color="amber" />
          <StatCard
            title="Completion Rate"
            value={completionRate.toFixed(1) + '%'}
            icon={Percent}
            color={completionRate >= 95 ? 'emerald' : completionRate >= 80 ? 'amber' : 'red'}
          />
        </div>
      )}

      {/* Tables */}
      {!loading && period && (
        <>
          {rows.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-12 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No production rows entered for this period yet.</p>
              <p className="text-xs text-slate-400 mt-1">Go to Reconciliation → {MONTH_NAMES[selectedMonth - 1]} {selectedYear} and add production rows.</p>
            </div>
          ) : (
            <>
              {PRODUCT_TYPES.map(type => (
                <SectionTable
                  key={type}
                  sectionRows={rows.filter(r => r.product_type === type)}
                  title={PRODUCT_TYPE_LABELS[type]}
                />
              ))}
              <SectionTable
                sectionRows={rows.filter(r => !PRODUCT_TYPES.includes(r.product_type))}
                title="Other Products"
              />

              {/* Grand totals bar */}
              <div className="bg-slate-900 text-white rounded-xl px-6 py-4">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold">
                  <div className="col-span-2 text-slate-300 text-sm">GRAND TOTALS</div>
                  <div className="text-right tabular-nums">{totals.opening.toLocaleString()}</div>
                  <div className="text-right tabular-nums text-emerald-400">{totals.received.toLocaleString()}</div>
                  <div className="text-right tabular-nums">{totals.total.toLocaleString()}</div>
                  <div className="text-right tabular-nums">{totals.expected.toLocaleString()}</div>
                  <div className="text-right tabular-nums text-teal-300">{totals.actual.toLocaleString()}</div>
                  <div className="text-right tabular-nums text-amber-400">{totals.wastage.toLocaleString()}</div>
                  <div className="text-right tabular-nums">{totals.closing.toLocaleString()}</div>
                  <div className="text-right tabular-nums">{totals.physical.toLocaleString()}</div>
                  <div className="text-right tabular-nums">{totals.system.toLocaleString()}</div>
                  <div className="text-right tabular-nums">
                    <span className={totals.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {totals.variance > 0 ? '+' : ''}{totals.variance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
