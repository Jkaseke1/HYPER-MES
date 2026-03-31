import React, { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Package, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatCard from '../components/ui/StatCard';

interface StockData {
  material_name: string;
  sage_code: string;
  opening_stock: number;
  receipts: number;
  issues: number;
  closing_stock: number;
  system_stock: number;
  variance: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function RawMaterialsReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchStockData() {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);
      
      // Fetch all raw materials
      const { data: rawMaterials, error: materialsError } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');

      if (materialsError) throw materialsError;

      // Fetch receipts (GRN items) for the selected month
      const { data: receipts, error: receiptsError } = await supabase
        .from('grn_items')
        .select(`
          received_qty,
          raw_material_id,
          goods_received_notes!inner(
            created_at
          )
        `)
        .gte('goods_received_notes.created_at', startDate.toISOString())
        .lte('goods_received_notes.created_at', endDate.toISOString());

      if (receiptsError) throw receiptsError;

      // Fetch issues (production order materials) for the selected month
      const { data: issues, error: issuesError } = await supabase
        .from('production_order_materials')
        .select(`
          actual_qty,
          raw_material_id,
          production_orders!inner(
            created_at,
            issued
          )
        `)
        .eq('production_orders.issued', true)
        .gte('production_orders.created_at', startDate.toISOString())
        .lte('production_orders.created_at', endDate.toISOString());

      if (issuesError) throw issuesError;

      // Process data for each material
      const processedData: StockData[] = rawMaterials?.map(material => {
        const materialReceipts = receipts
          ?.filter(r => r.raw_material_id === material.id)
          .reduce((sum, r) => sum + (r.received_qty || 0), 0) || 0;

        const materialIssues = issues
          ?.filter(i => i.raw_material_id === material.id)
          .reduce((sum, i) => sum + (i.actual_qty || 0), 0) || 0;

        const systemStock = material.current_stock || 0;
        
        // Calculate opening stock (current stock minus receipts plus issues)
        const openingStock = systemStock - materialReceipts + materialIssues;
        const closingStock = openingStock + materialReceipts - materialIssues;
        const variance = closingStock - systemStock;

        return {
          material_name: material.name,
          sage_code: material.sage_code || '',
          opening_stock: Math.max(0, openingStock),
          receipts: materialReceipts,
          issues: materialIssues,
          closing_stock: Math.max(0, closingStock),
          system_stock: systemStock,
          variance: variance
        };
      }) || [];

      setStockData(processedData);

    } catch (error: any) {
      console.error('Error fetching stock data:', error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    fetchStockData();
  }, [selectedMonth, selectedYear]);

  // Calculate summary metrics
  const totalOpeningValue = stockData.reduce((sum, item) => sum + item.opening_stock, 0);
  const totalReceiptsValue = stockData.reduce((sum, item) => sum + item.receipts, 0);
  const totalIssuesValue = stockData.reduce((sum, item) => sum + item.issues, 0);
  const totalClosingValue = stockData.reduce((sum, item) => sum + item.closing_stock, 0);

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-emerald-600 bg-emerald-50';
    if (Math.abs(variance) <= 10) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const exportToCSV = () => {
    const headers = [
      'Material Name', 'Sage Code', 'Opening Stock', 'Receipts', 
      'Issues to Production', 'Closing Stock', 'System Stock', 'Variance'
    ];
    const rows = stockData.map(item => [
      item.material_name,
      item.sage_code,
      item.opening_stock.toString(),
      item.receipts.toString(),
      item.issues.toString(),
      item.closing_stock.toString(),
      item.system_stock.toString(),
      item.variance.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-materials-report-${MONTH_NAMES[selectedMonth]}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Raw Materials Stock Report</h1>
          <p className="text-sm text-slate-600 mt-1">Monthly stock movement analysis</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-3 h-3" />
          Last refresh: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-700">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            {MONTH_NAMES.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            {[2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchStockData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Opening Stock Value" 
          value={`${totalOpeningValue.toLocaleString()} kg`} 
          icon={Package} 
          color="slate" 
        />
        <StatCard 
          title="Total Receipts Value" 
          value={`${totalReceiptsValue.toLocaleString()} kg`} 
          icon={TrendingUp} 
          color="emerald" 
        />
        <StatCard 
          title="Total Issues Value" 
          value={`${totalIssuesValue.toLocaleString()} kg`} 
          icon={TrendingDown} 
          color="amber" 
        />
        <StatCard 
          title="Closing Stock Value" 
          value={`${totalClosingValue.toLocaleString()} kg`} 
          icon={Package} 
          color="teal" 
        />
      </div>

      {/* Stock Movement Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Stock Movement Details</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Material Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Sage Code</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Opening Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Receipts</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Issues to Production</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Closing Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">System Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-20 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                    </div>
                  </td>
                </tr>
              ) : stockData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-20 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No stock data found</p>
                  </td>
                </tr>
              ) : (
                stockData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.material_name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {item.sage_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{item.opening_stock.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">+{item.receipts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-amber-600">-{item.issues.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.closing_stock.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{item.system_stock.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVarianceColor(item.variance)}`}>
                        {item.variance >= 0 ? '+' : ''}{item.variance.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{stockData.length} materials shown</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-emerald-100"></div>
                <span>No variance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-100"></div>
                <span>Small variance (≤10kg)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-100"></div>
                <span>Large variance (&gt;10kg)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
