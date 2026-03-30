import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, CreditCard as Edit2, Trash2, Package, AlertTriangle, DollarSign, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RawMaterial } from '../types/database';
import Modal from '../components/ui/Modal';
import StatCard from '../components/ui/StatCard';

const CATEGORIES = ['grain', 'protein', 'mineral', 'vitamin', 'additive', 'other'] as const;
const UNITS = ['kg', 'ton', 'litre', 'bag'] as const;
const TABS = ['All', ...CATEGORIES] as const;

const emptyForm = { name: '', code: '', category: 'grain', unit: 'ton', cost_per_unit: 0, reorder_level: 0, description: '', currency_code: 'USD', warehouse_id: '' };

function getStockStatus(current: number, reorder: number): string {
  if (current === 0) return 'out_of_stock';
  if (current <= reorder && reorder > 0) return 'low_stock';
  return 'in_stock';
}

const stockStyles: Record<string, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border-red-200',
};

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [deleting, setDeleting] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Inline reorder level editing state
  const [editingReorder, setEditingReorder] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState<string>('');

  async function fetchMaterials() {
    setLoading(true);
    const { data } = await supabase.from('raw_materials').select('*').order('name');
    setMaterials(data || []);
    setLoading(false);
  }

  async function fetchCurrencies() {
    const { data } = await supabase.from('currencies').select('*').eq('is_active', true).order('code');
    setCurrencies(data || []);
  }

  async function fetchWarehouses() {
    const { data } = await supabase.from('warehouses').select('*').eq('is_active', true).order('name');
    setWarehouses(data || []);
  }

  useEffect(() => { 
    fetchMaterials(); 
    fetchCurrencies();
    fetchWarehouses();
  }, []);

  const filtered = useMemo(() => {
    let list = materials;
    if (activeTab !== 'All') list = list.filter((m) => m.category === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
    }
    return list;
  }, [materials, activeTab, search]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(m: RawMaterial) {
    setEditing(m);
    setForm({ name: m.name, code: m.code, category: m.category, unit: m.unit, cost_per_unit: m.cost_per_unit, reorder_level: m.reorder_level, description: m.description || '', currency_code: m.currency_code || 'USD', warehouse_id: m.warehouse_id || '' });
    setModalOpen(true);
  }

  function openDelete(m: RawMaterial) {
    setDeleting(m);
    setDeleteModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let result;
      if (editing) {
        result = await supabase.from('raw_materials').update(form).eq('id', editing.id);
      } else {
        result = await supabase.from('raw_materials').insert(form);
      }
      
      if (result.error) {
        console.error('Error saving material:', result.error);
        alert(`Error: ${result.error.message}`);
        setSaving(false);
        return;
      }
      
      setSaving(false);
      setModalOpen(false);
      fetchMaterials();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred. Please try again.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    await supabase.from('raw_materials').delete().eq('id', deleting.id);
    setSaving(false);
    setDeleteModalOpen(false);
    setDeleting(null);
    fetchMaterials();
  }

  // Inline reorder level editing functions
  function startEditingReorder(materialId: string, currentValue: number) {
    setEditingReorder(materialId);
    setReorderValue(currentValue.toString());
  }

  async function saveReorderLevel(materialId: string) {
    const newValue = parseFloat(reorderValue) || 0;
    
    try {
      const { error } = await supabase
        .from('raw_materials')
        .update({ reorder_level: newValue })
        .eq('id', materialId);

      if (error) throw error;

      // Update local state
      setMaterials(prev => prev.map(m => 
        m.id === materialId ? { ...m, reorder_level: newValue } : m
      ));
    } catch (error: any) {
      console.error('Error saving reorder level:', error);
      alert('Failed to save reorder level: ' + error.message);
    }
    
    setEditingReorder(null);
    setReorderValue('');
  }

  function cancelEditingReorder() {
    setEditingReorder(null);
    setReorderValue('');
  }

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';

  const totalMaterials = materials.length;
  const lowStockCount = materials.filter(m => m.current_stock <= m.reorder_level && m.current_stock > 0).length;
  const outOfStockCount = materials.filter(m => m.current_stock <= 0).length;
  const totalValue = materials.reduce((sum, m) => sum + (m.current_stock * m.cost_per_unit), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Raw Materials</h1>
          <p className="text-sm text-slate-500 mt-1">Manage inventory of raw materials and ingredients</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Materials" value={totalMaterials} icon={Package} color="teal" />
        <StatCard title="Low Stock" value={lowStockCount} icon={AlertTriangle} color="amber" />
        <StatCard title="Out of Stock" value={outOfStockCount} icon={Layers} color="red" />
        <StatCard title="Total Value" value={`$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={DollarSign} color="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No materials found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  {['Code', 'Name', 'Category', 'Unit', 'Cost/Unit', 'Current Stock', 'Reorder Level', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((m) => {
                  const status = getStockStatus(m.current_stock, m.reorder_level);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-3 text-slate-600">{m.category.charAt(0).toUpperCase() + m.category.slice(1)}</td>
                      <td className="px-4 py-3 text-slate-600">{m.unit}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{m.cost_per_unit.toLocaleString('en-US', { style: 'currency', currency: m.currency_code || 'USD' })}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {status === 'low_stock' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          <span className={status === 'out_of_stock' ? 'text-red-600 font-medium' : 'text-slate-700'}>{m.current_stock.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingReorder === m.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={reorderValue}
                              onChange={(e) => setReorderValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveReorderLevel(m.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditingReorder();
                                }
                              }}
                              onBlur={() => saveReorderLevel(m.id)}
                              className="w-20 px-2 py-1 border border-teal-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                              autoFocus
                            />
                            <button
                              onClick={() => saveReorderLevel(m.id)}
                              className="p-1 rounded text-teal-600 hover:bg-teal-50"
                              title="Save"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEditingReorder}
                              className="p-1 rounded text-slate-400 hover:bg-slate-50"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingReorder(m.id, m.reorder_level)}
                            className="text-slate-600 hover:text-teal-600 hover:bg-teal-50 px-2 py-1 rounded text-sm transition-colors"
                            title="Click to edit reorder level"
                          >
                            {m.reorder_level.toLocaleString()}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${stockStyles[status]}`}>
                          {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => openDelete(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">{filtered.length} material{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Material' : 'Add Material'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Yellow Maize" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Code</label>
              <input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} placeholder="e.g. RM-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cost per Unit</label>
              <input type="number" required min="0" step="0.01" value={form.cost_per_unit || ''} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value === '' ? 0 : parseFloat(e.target.value) })} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
              <select value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value })} className={inputClass}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reorder Level</label>
              <input type="number" required min="0" step="0.01" value={form.reorder_level || ''} onChange={(e) => setForm({ ...form, reorder_level: e.target.value === '' ? 0 : parseFloat(e.target.value) })} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Warehouse</label>
              <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className={inputClass}>
                <option value="">Select Warehouse (Optional)</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Optional description..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update Material' : 'Add Material'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Material" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">Are you sure you want to delete <span className="font-semibold">{deleting?.name}</span>? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
