import { useState, useEffect } from 'react';
import { Plus, Calendar, ChevronRight, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Branch } from '../types/database';
import type { ReconciliationPeriod } from '../types/reconciliation';
import { MONTH_NAMES } from '../types/reconciliation';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import ReconciliationDetail from './ReconciliationDetail';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function ReconciliationPage() {
  const [periods, setPeriods] = useState<ReconciliationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReconciliationPeriod | null>(null);
  const [newMonth, setNewMonth] = useState(currentMonth);
  const [newYear, setNewYear] = useState(currentYear);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [newStatus, setNewStatus] = useState<ReconciliationPeriod['status']>('draft');
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchPeriods() {
    setLoading(true);
    const { data } = await supabase
      .from('reconciliation_periods')
      .select('*, branches(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    setPeriods(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchPeriods(); }, []);
  useEffect(() => {
    supabase.from('branches').select('id, name').eq('is_active', true).then(({ data }) => {
      setBranches((data as Branch[]) || []);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    e.preventDefault();
    if (!newBranch) {
      setFormError('Please select a branch.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const { data, error } = await supabase
      .from('reconciliation_periods')
      .insert({ month: newMonth, year: newYear, status: newStatus, branch_id: newBranch })
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setModalOpen(false);
    setNewBranch('');
    setNewStatus('draft');
    if (data) {
      setSelectedPeriod(data as ReconciliationPeriod);
    }
    fetchPeriods();
  }

  if (selectedPeriod) {
    return (
      <ReconciliationDetail
        period={selectedPeriod}
        onBack={() => { setSelectedPeriod(null); fetchPeriods(); }}
        onUpdate={(updated) => setSelectedPeriod(updated)}
      />
    );
  }

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Material Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly stock reconciliation across all production stages</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Period
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
          <FileCheck className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">No reconciliation periods yet</p>
          <p className="text-xs mt-1">Create your first monthly reconciliation to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Received RM</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actual Production</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actual Dispatched</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Dispatch Variance</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {periods.map((period) => {
                  const totalVariance = period.actual_dispatched_t - period.expected_dispatched_t;
                  return (
                    <tr key={period.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">
                              {MONTH_NAMES[period.month - 1]} {period.year}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">{period.branches?.name || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-slate-800">{period.received_raw_materials_t.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 ml-1">T</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-slate-800">{period.actual_declared_production_t.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 ml-1">T</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-slate-800">{period.actual_dispatched_t.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 ml-1">T</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {totalVariance !== 0 ? (
                          <span className={`text-sm font-semibold ${totalVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {totalVariance > 0 ? '+' : ''}{totalVariance.toLocaleString()} T
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={period.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedPeriod(period)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          View Details
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Reconciliation Period" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Month</label>
            <select value={newMonth} onChange={(e) => setNewMonth(parseInt(e.target.value))} className={inputClass}>
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Year</label>
            <select value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value))} className={inputClass}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch</label>
            <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className={inputClass}>
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Initial Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ReconciliationPeriod['status'])} className={inputClass}>
              {['draft', 'in_progress', 'completed', 'approved'].map((status) => (
                <option key={status} value={status}>{status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
