import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, BarChart3, Package, Percent, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatCard from '../components/ui/StatCard';

interface ProductionData {
  formulation_name: string;
  sage_code: string;
  batches_count: number;
  planned_qty: number;
  actual_qty: number;
  variance: number;
  variance_percentage: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ProductionReportPage() {
  console.log('ProductionReportPage loaded!');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchProductionData() {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);
      
      // Fetch completed production orders for the selected month
      const { data: orders, error: ordersError } = await supabase
        .from('production_orders')
        .select(`
          id,
          planned_qty,
          actual_qty,
          status,
          created_at,
          formulations!inner(
            id,
            name,
            sage_code
          )
        `)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at');

      if (ordersError) throw ordersError;

      // Process data for summary table
      const formulationMap = new Map<string, ProductionData>();
      
      orders?.forEach(order => {
        const formulation = order.formulations as any;
        const sageCode = formulation.sage_code;
        const existing = formulationMap.get(sageCode) || {
          formulation_name: formulation.name,
          sage_code: sageCode,
          batches_count: 0,
          planned_qty: 0,
          actual_qty: 0,
          variance: 0,
          variance_percentage: 0
        };

        existing.batches_count += 1;
        existing.planned_qty += order.planned_qty || 0;
        existing.actual_qty += order.actual_qty || 0;
        
        formulationMap.set(sageCode, existing);
      });

      // Calculate variances
      const processedData = Array.from(formulationMap.values()).map(item => {
        item.variance = item.actual_qty - item.planned_qty;
        item.variance_percentage = item.planned_qty > 0 
          ? (item.variance / item.planned_qty) * 100 
          : 0;
        return item;
      });

      setProductionData(processedData);

    } catch (error: any) {
      console.error('Error fetching production data:', error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    fetchProductionData();
  }, [selectedMonth, selectedYear]);

  // Calculate summary metrics
  const totalBatches = productionData.reduce((sum, item) => sum + item.batches_count, 0);
  const totalTonnage = productionData.reduce((sum, item) => sum + item.actual_qty, 0);
  const avgBatchSize = totalBatches > 0 ? totalTonnage / totalBatches : 0;
  const completionRate = productionData.reduce((sum, item) => sum + item.planned_qty, 0) > 0
    ? (totalTonnage / productionData.reduce((sum, item) => sum + item.planned_qty, 0)) * 100
    : 0;

  const exportToCSV = () => {
    const headers = ['Formulation Name', 'Sage Code', 'Batches', 'Planned Qty (kg)', 'Actual Qty (kg)', 'Variance (kg)', 'Variance %'];
    const rows = productionData.map(item => [
      item.formulation_name,
      item.sage_code,
      item.batches_count.toString(),
      item.planned_qty.toString(),
      item.actual_qty.toString(),
      item.variance.toString(),
      `${item.variance_percentage.toFixed(2)}%`
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-report-${MONTH_NAMES[selectedMonth]}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Report</h1>
          <p className="text-sm text-slate-600 mt-1">Monthly production output analysis</p>
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
          onClick={fetchProductionData}
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
          title="Total Batches" 
          value={totalBatches.toLocaleString()} 
          icon={Package} 
          color="teal" 
        />
        <StatCard 
          title="Total Tonnage" 
          value={`${totalTonnage.toLocaleString()} kg`} 
          icon={Activity} 
          color="emerald" 
        />
        <StatCard 
          title="Avg Batch Size" 
          value={`${avgBatchSize.toLocaleString()} kg`} 
          icon={BarChart3} 
          color="blue" 
        />
        <StatCard 
          title="Completion Rate" 
          value={`${completionRate.toFixed(1)}%`} 
          icon={Percent} 
          color="amber" 
        />
      </div>

      {/* Production Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Production Summary by Formulation</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Formulation Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Sage Code</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Batches</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Planned Qty (kg)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actual Qty (kg)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Variance (kg)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                    </div>
                  </td>
                </tr>
              ) : productionData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No production data found</p>
                  </td>
                </tr>
              ) : (
                productionData.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.formulation_name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {item.sage_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{item.batches_count}</td>
                    <td className="px-4 py-3 text-right">{item.planned_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.actual_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${item.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.variance >= 0 ? '+' : ''}{item.variance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${item.variance_percentage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.variance_percentage >= 0 ? '+' : ''}{item.variance_percentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
