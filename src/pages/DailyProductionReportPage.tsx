import { useState, useEffect } from 'react';
import { Plus, Calendar, Factory, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface DailyReport {
  id: string;
  report_date: string;
  branch_id: string;
  shift: 'day' | 'night';
  batch_number: string;
  plant_name: string;
  formulation_id: string | null;
  product_name: string;
  daily_target: number | null;
  quantity_produced: number;
  quantity_sold: number | null;
  vet_sales: number | null;
  equipment_sales: number | null;
  labour_force: number | null;
  status: 'active' | 'completed' | 'no_production';
  downtime_hours: number | null;
  downtime_reason: string | null;
  notes: string | null;
  reported_by: string | null;
  created_at: string;
  branches?: { name: string };
}

export default function DailyProductionReportPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const { profile } = useAuth();

  const [form, setForm] = useState({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    shift: 'day' as 'day' | 'night',
    batch_number: '',
    plant_name: '',
    product_name: '',
    daily_target: '',
    quantity_produced: '',
    quantity_sold: '',
    vet_sales: '',
    equipment_sales: '',
    labour_force: '',
    status: 'active' as 'active' | 'completed' | 'no_production',
    downtime_hours: '',
    downtime_reason: '',
    notes: '',
  });

  useEffect(() => {
    fetchReports();
  }, [selectedDate]);

  async function fetchReports() {
    setLoading(true);
    const { data } = await supabase
      .from('daily_production_reports')
      .select('*, branches(name)')
      .eq('report_date', selectedDate)
      .order('shift', { ascending: true })
      .order('plant_name', { ascending: true });
    
    if (data) setReports(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const { error } = await supabase.from('daily_production_reports').insert({
      ...form,
      daily_target: form.daily_target ? parseFloat(form.daily_target) : null,
      quantity_produced: parseFloat(form.quantity_produced),
      quantity_sold: form.quantity_sold ? parseFloat(form.quantity_sold) : null,
      vet_sales: form.vet_sales ? parseFloat(form.vet_sales) : null,
      equipment_sales: form.equipment_sales ? parseFloat(form.equipment_sales) : null,
      labour_force: form.labour_force ? parseInt(form.labour_force) : null,
      downtime_hours: form.downtime_hours ? parseFloat(form.downtime_hours) : null,
      branch_id: null,
      reported_by: profile?.id,
    });

    if (!error) {
      setShowForm(false);
      fetchReports();
      resetForm();
    }
  }

  function resetForm() {
    setForm({
      report_date: format(new Date(), 'yyyy-MM-dd'),
      shift: 'day',
      batch_number: '',
      plant_name: '',
      product_name: '',
      daily_target: '',
      quantity_produced: '',
      quantity_sold: '',
      vet_sales: '',
      equipment_sales: '',
      labour_force: '',
      status: 'active',
      downtime_hours: '',
      downtime_reason: '',
      notes: '',
    });
  }

  const totalProduction = reports.reduce((sum, r) => sum + r.quantity_produced, 0);
  const totalTarget = reports.reduce((sum, r) => sum + (r.daily_target || 0), 0);
  const totalSold = reports.reduce((sum, r) => sum + (r.quantity_sold || 0), 0);
  const efficiency = totalTarget > 0 ? ((totalProduction / totalTarget) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daily Production Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Track daily production across all plants</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Factory className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Production</p>
              <p className="text-xl font-bold text-slate-800">{totalProduction.toFixed(2)}t</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Target</p>
              <p className="text-xl font-bold text-slate-800">{totalTarget.toFixed(2)}t</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Sold</p>
              <p className="text-xl font-bold text-slate-800">{totalSold.toFixed(2)}t</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Efficiency</p>
              <p className="text-xl font-bold text-slate-800">{efficiency}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">New Production Report</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Report Date</label>
                <input
                  type="date"
                  value={form.report_date}
                  onChange={(e) => setForm({ ...form, report_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shift</label>
                <select
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value as 'day' | 'night' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                <input
                  type="text"
                  value={form.batch_number}
                  onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="B/N 071326"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plant Name</label>
                <input
                  type="text"
                  value={form.plant_name}
                  onChange={(e) => setForm({ ...form, plant_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Main Plant, Dog Plant, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="BFAM, Samurai 7 Mix, etc."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Target (t)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.daily_target}
                  onChange={(e) => setForm({ ...form, daily_target: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Produced (t)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.quantity_produced}
                  onChange={(e) => setForm({ ...form, quantity_produced: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sold (t)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.quantity_sold}
                  onChange={(e) => setForm({ ...form, quantity_sold: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Labour Force</label>
                <input
                  type="number"
                  value={form.labour_force}
                  onChange={(e) => setForm({ ...form, labour_force: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="no_production">No Production</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Downtime (hours)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.downtime_hours}
                  onChange={(e) => setForm({ ...form, downtime_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Downtime Reason</label>
                <input
                  type="text"
                  value={form.downtime_reason}
                  onChange={(e) => setForm({ ...form, downtime_reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Power outage, maintenance, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                rows={2}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
              >
                Save Report
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Shift', 'Batch #', 'Plant', 'Product', 'Target', 'Produced', 'Sold', 'Labour', 'Downtime', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No production reports for {format(new Date(selectedDate), 'dd MMM yyyy')}
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        report.shift === 'day' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {report.shift.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{report.batch_number || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{report.plant_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{report.product_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{report.daily_target?.toFixed(2) || '-'}t</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{report.quantity_produced.toFixed(2)}t</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{report.quantity_sold?.toFixed(2) || '-'}t</td>
                    <td className="px-4 py-3">
                      {report.labour_force && (
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          {report.labour_force}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {report.downtime_hours && report.downtime_hours > 0 ? (
                        <div className="flex items-center gap-1 text-sm text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          {report.downtime_hours}h
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        report.status === 'completed' ? 'bg-teal-100 text-teal-700' :
                        report.status === 'no_production' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {report.status.replace('_', ' ').toUpperCase()}
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
