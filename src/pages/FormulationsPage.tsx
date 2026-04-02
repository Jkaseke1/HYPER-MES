import { useState, useEffect, useCallback } from 'react';
import { Plus, FlaskConical, CreditCard as Edit2, Trash2, Search, ChevronRight, GitCompare, X, CheckCircle2, FileText, Archive } from 'lucide-react';
import { Formulation, FormulationIngredient, RawMaterial } from '../types/database';
import { supabase } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import StatCard from '../components/ui/StatCard';

const CATEGORY_FILTERS = ['All', 'broiler', 'layer', 'dairy', 'pig', 'horse', 'pet', 'other'] as const;
const CATEGORY_OPTIONS = CATEGORY_FILTERS.filter(c => c !== 'All') as string[];
const formatLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type UnitSizeVariant = { size: string; batch_size: number };

type FormState = {
  name: string;
  code: string;
  sage_code: string;
  version: number;
  category: string;
  description: string;
  batch_size: string;
  batch_unit: string;
  unit_size_variants: UnitSizeVariant[];
  target_protein: string;
  target_fat: string;
  target_fiber: string;
  target_moisture: string;
  estimated_cost_per_unit: number;
  status: 'draft' | 'active' | 'archived';
};

const emptyForm: FormState = {
  name: '',
  code: '',
  sage_code: '',
  version: 1,
  category: 'broiler',
  description: '',
  batch_size: '',
  batch_unit: 'kg',
  unit_size_variants: [],
  target_protein: '',
  target_fat: '',
  target_fiber: '',
  target_moisture: '',
  estimated_cost_per_unit: 0,
  status: 'draft',
};

type IngRow = { raw_material_id: string; quantity: number; unit: string; percentage: number; is_critical: boolean };
const emptyIng = (): IngRow => ({ raw_material_id: '', quantity: 0, unit: 'kg', percentage: 0, is_critical: false });

export default function FormulationsPage() {
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [materials, setMaterials] = useState<Pick<RawMaterial, 'id' | 'name' | 'code' | 'unit'>[]>([]);
  const [formulationIngredientCounts, setFormulationIngredientCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('All');
  const [ingredientFilter, setIngredientFilter] = useState<'all' | 'with' | 'without'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Formulation | null>(null);
  const [detailIngs, setDetailIngs] = useState<FormulationIngredient[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [ings, setIngs] = useState<IngRow[]>([emptyIng()]);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<Formulation[]>([]);
  const [compareIngs, setCompareIngs] = useState<[FormulationIngredient[], FormulationIngredient[]]>([[], []]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [bomEditMode, setBomEditMode] = useState(false);
  const [bomEditIngs, setBomEditIngs] = useState<FormulationIngredient[]>([]);

  const fetchFormulations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('formulations').select('*').order('name');
    setFormulations(data || []);
    
    // Fetch ingredient counts for each formulation
    if (data && data.length > 0) {
      const { data: ingredientData } = await supabase
        .from('formulation_ingredients')
        .select('formulation_id');
      
      const counts: Record<string, number> = {};
      ingredientData?.forEach(ing => {
        counts[ing.formulation_id] = (counts[ing.formulation_id] || 0) + 1;
      });
      setFormulationIngredientCounts(counts);
    }
    
    setLoading(false);
  }, []);

  const fetchMaterials = useCallback(async () => {
    const { data } = await supabase.from('raw_materials').select('id, name, code, unit').eq('is_active', true);
    setMaterials(data || []);
  }, []);

  useEffect(() => { fetchFormulations(); fetchMaterials(); }, [fetchFormulations, fetchMaterials]);

  const filtered = formulations.filter(f => {
    if (filter !== 'All' && f.category !== filter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.code.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Filter by ingredient status
    const hasIngredients = (formulationIngredientCounts[f.id] || 0) > 0;
    if (ingredientFilter === 'with' && !hasIngredients) return false;
    if (ingredientFilter === 'without' && hasIngredients) return false;
    
    return true;
  });
  
  const withIngredients = filtered.filter(f => (formulationIngredientCounts[f.id] || 0) > 0);
  const withoutIngredients = filtered.filter(f => (formulationIngredientCounts[f.id] || 0) === 0);

  function toggleCompareSelect(f: Formulation) {
    setCompareSelected(prev => {
      if (prev.find(p => p.id === f.id)) return prev.filter(p => p.id !== f.id);
      if (prev.length >= 2) return [prev[1], f];
      return [...prev, f];
    });
  }

  async function openCompare() {
    if (compareSelected.length !== 2) return;
    const [a, b] = compareSelected;
    const [ra, rb] = await Promise.all([
      supabase.from('formulation_ingredients').select('*, raw_materials(*)').eq('formulation_id', a.id).order('sort_order'),
      supabase.from('formulation_ingredients').select('*, raw_materials(*)').eq('formulation_id', b.id).order('sort_order'),
    ]);
    setCompareIngs([ra.data || [], rb.data || []]);
    setCompareOpen(true);
  }

  async function openDetail(f: Formulation) {
    setSelected(f);
    const { data } = await supabase.from('formulation_ingredients').select('*, raw_materials(*)').eq('formulation_id', f.id).order('sort_order');
    setDetailIngs(data || []);
    setDetailOpen(true);
  }

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm });
    setIngs([emptyIng()]);
    setEditOpen(true);
  }

  async function openEdit(f: Formulation) {
    setEditId(f.id);
    setForm({
      name: f.name,
      code: f.code,
      sage_code: (f as any).sage_code || '',
      version: f.version,
      category: f.category,
      description: f.description,
      batch_size: f.batch_size.toString(),
      batch_unit: f.batch_unit,
      unit_size_variants: (f as any).unit_size_variants || [],
      target_protein: f.target_protein.toString(),
      target_fat: f.target_fat.toString(),
      target_fiber: f.target_fiber.toString(),
      target_moisture: f.target_moisture.toString(),
      estimated_cost_per_unit: f.estimated_cost_per_unit,
      status: f.status,
    });
    const { data } = await supabase.from('formulation_ingredients').select('*').eq('formulation_id', f.id).order('sort_order');
    setIngs((data || []).map(i => ({ raw_material_id: i.raw_material_id, quantity: i.quantity, unit: i.unit, percentage: i.percentage, is_critical: i.is_critical })));
    setDetailOpen(false);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      alert('Name and Code are required.');
      return;
    }

    if (!form.batch_size) {
      alert('Please provide a batch size.');
      return;
    }

    if (ings.every(i => !i.raw_material_id)) {
      alert('Add at least one ingredient before saving.');
      return;
    }

    if (Math.abs(totalPct - 100) > 0.1) {
      alert('Ingredient percentages must total 100%.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        batch_size: Number(form.batch_size) || 0,
        target_protein: Number(form.target_protein) || 0,
        target_fat: Number(form.target_fat) || 0,
        target_fiber: Number(form.target_fiber) || 0,
        target_moisture: Number(form.target_moisture) || 0,
        updated_at: new Date().toISOString(),
      };

      let fId = editId;
      if (editId) {
        const { error } = await supabase.from('formulations').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('formulations').insert(payload).select('id').single();
        if (error) throw error;
        fId = data?.id || null;
      }

      if (!fId) throw new Error('Formulation ID missing after save.');

      const rows = ings
        .filter(i => i.raw_material_id)
        .map((i, idx) => ({
          formulation_id: fId!,
          raw_material_id: i.raw_material_id,
          quantity: i.quantity,
          unit: i.unit,
          percentage: i.percentage,
          is_critical: i.is_critical,
          notes: '',
          sort_order: idx,
        }));

      await supabase.from('formulation_ingredients').delete().eq('formulation_id', fId);
      if (rows.length) {
        const { error } = await supabase.from('formulation_ingredients').insert(rows);
        if (error) throw error;
      }

      setEditOpen(false);
      fetchFormulations();
    } catch (error: any) {
      console.error('Error saving formulation:', error);
      alert(`Failed to save formulation: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this formulation and all its ingredients?')) return;
    await supabase.from('formulation_ingredients').delete().eq('formulation_id', id);
    await supabase.from('formulations').delete().eq('id', id);
    setDetailOpen(false);
    fetchFormulations();
  }

  async function saveBomEdits() {
    if (!selected) return;
    setSaving(true);
    try {
      // Update all ingredients
      for (const ing of bomEditIngs) {
        const { error } = await supabase
          .from('formulation_ingredients')
          .update({
            quantity: ing.quantity,
            unit: ing.unit,
            percentage: ing.percentage,
            is_critical: ing.is_critical,
          })
          .eq('id', ing.id);
        
        if (error) throw error;
      }
      
      setBomEditMode(false);
      // Refresh detail view
      const { data } = await supabase.from('formulation_ingredients').select('*, raw_materials(*)').eq('formulation_id', selected.id).order('sort_order');
      setDetailIngs(data || []);
      fetchFormulations();
    } catch (error: any) {
      console.error('Error saving BOM:', error);
      alert(`Failed to save BOM: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  const totalPct = ings.reduce((s, i) => s + (Number(i.percentage) || 0), 0);

  const catColor: Record<string, string> = {
    broiler: 'bg-amber-50 text-amber-700',
    layer: 'bg-orange-50 text-orange-700',
    dairy: 'bg-sky-50 text-sky-700',
    pig: 'bg-rose-50 text-rose-700',
    horse: 'bg-teal-50 text-teal-700',
    pet: 'bg-cyan-50 text-cyan-700',
    other: 'bg-slate-100 text-slate-600',
  };

  const totalFormulas = formulations.length;
  const activeCount = formulations.filter(f => f.status === 'active').length;
  const draftCount = formulations.filter(f => f.status === 'draft').length;
  const archivedCount = formulations.filter(f => f.status === 'archived').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Formulations</h1>
          <p className="text-sm text-slate-500 mt-1">Bill of Materials for feed manufacturing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCompareMode(m => !m); setCompareSelected([]); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              compareMode ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            {compareMode ? `Compare (${compareSelected.length}/2)` : 'Compare'}
          </button>
          {compareMode && compareSelected.length === 2 && (
            <button onClick={openCompare} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors">
              <GitCompare className="w-4 h-4" /> View Comparison
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> New Formula
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Formulas" value={totalFormulas} icon={FlaskConical} color="teal" />
        <StatCard title="Active" value={activeCount} icon={CheckCircle2} color="emerald" />
        <StatCard title="Draft" value={draftCount} icon={FileText} color="amber" />
        <StatCard title="Archived" value={archivedCount} icon={Archive} color="slate" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_FILTERS.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === c ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
              >
                {c === 'All' ? 'All' : formatLabel(c)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search formulas..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-64" />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setIngredientFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${ingredientFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
          >
            All Formulas
          </button>
          <button
            onClick={() => setIngredientFilter('with')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${ingredientFilter === 'with' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
          >
            With Ingredients ({withIngredients.length})
          </button>
          <button
            onClick={() => setIngredientFilter('without')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${ingredientFilter === 'without' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
          >
            Without Ingredients ({withoutIngredients.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading formulations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No formulations found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Formulations WITH Ingredients */}
          {(ingredientFilter === 'all' || ingredientFilter === 'with') && withIngredients.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <h3 className="text-sm font-semibold text-slate-700">Formulas with Ingredients ({withIngredients.length})</h3>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-emerald-50 border-b border-emerald-200">
                      <tr>
                        {compareMode && <th className="px-4 py-3 text-left w-12"><input type="checkbox" className="rounded border-slate-300" disabled /></th>}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider">Formula</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider">Ingredients</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider">Version</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider">Batch Size</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase tracking-wider">Cost/Unit</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {withIngredients.map(f => (
                        <tr 
                          key={f.id}
                          className={`hover:bg-emerald-50 transition-colors ${
                            compareSelected.find(c => c.id === f.id)
                              ? 'bg-amber-50'
                              : ''
                          }`}
                        >
                          {compareMode && (
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!compareSelected.find(c => c.id === f.id)}
                                onChange={() => toggleCompareSelect(f)}
                                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" 
                              />
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => compareMode ? toggleCompareSelect(f) : openDetail(f)}
                              className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                <FlaskConical className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="font-medium text-slate-800 hover:underline">{f.name}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">{f.code}</code>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${catColor[f.category] || catColor.other}`}>
                              {formatLabel(f.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                              {formulationIngredientCounts[f.id] || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-slate-700">v{f.version}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-slate-700">{f.batch_size.toLocaleString()} {f.batch_unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-teal-700">${f.estimated_cost_per_unit.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={f.status} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openDetail(f)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Formulations WITHOUT Ingredients */}
          {(ingredientFilter === 'all' || ingredientFilter === 'without') && withoutIngredients.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <h3 className="text-sm font-semibold text-slate-700">Formulas without Ingredients ({withoutIngredients.length})</h3>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-amber-50 border-b border-amber-200">
                      <tr>
                        {compareMode && <th className="px-4 py-3 text-left w-12"><input type="checkbox" className="rounded border-slate-300" disabled /></th>}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Formula</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider">Version</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider">Batch Size</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase tracking-wider">Cost/Unit</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-amber-700 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {withoutIngredients.map(f => (
                        <tr 
                          key={f.id}
                          className={`hover:bg-amber-50 transition-colors ${
                            compareSelected.find(c => c.id === f.id)
                              ? 'bg-amber-100'
                              : ''
                          }`}
                        >
                          {compareMode && (
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!compareSelected.find(c => c.id === f.id)}
                                onChange={() => toggleCompareSelect(f)}
                                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" 
                              />
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => compareMode ? toggleCompareSelect(f) : openDetail(f)}
                              className="flex items-center gap-2 hover:text-amber-600 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <FlaskConical className="w-4 h-4 text-amber-600" />
                              </div>
                              <span className="font-medium text-slate-800 hover:underline">{f.name}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">{f.code}</code>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${catColor[f.category] || catColor.other}`}>
                              {formatLabel(f.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-slate-700">v{f.version}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-slate-700">{f.batch_size.toLocaleString()} {f.batch_unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-teal-700">${f.estimated_cost_per_unit.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={f.status} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openDetail(f)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOM Comparison Modal */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="BOM Comparison" size="xl">
        {compareSelected.length === 2 && (
          <div className="space-y-5">
            {/* Header row */}
            <div className="grid grid-cols-2 gap-4">
              {compareSelected.map((f, idx) => (
                <div key={f.id} className={`rounded-xl border-2 p-4 ${idx === 0 ? 'border-teal-300 bg-teal-50/40' : 'border-amber-300 bg-amber-50/40'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white ${idx === 0 ? 'bg-teal-500' : 'bg-amber-500'}`}>{idx + 1}</span>
                    <p className="font-semibold text-slate-800">{f.name}</p>
                    <span className="text-xs text-slate-500 ml-auto">{f.code}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[['Batch', `${f.batch_size} ${f.batch_unit}`], ['Cost/Unit', `$${f.estimated_cost_per_unit.toFixed(2)}`], ['Protein', `${f.target_protein}%`], ['Fat', `${f.target_fat}%`]].map(([l, v]) => (
                      <div key={l} className="bg-white/70 rounded px-2 py-1"><span className="text-slate-400">{l}: </span><span className="font-medium text-slate-700">{v}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Ingredient comparison table */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Ingredient Comparison</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Material</th>
                      <th className="text-center px-4 py-2 font-medium text-teal-600">{compareSelected[0].code} %</th>
                      <th className="text-center px-4 py-2 font-medium text-amber-600">{compareSelected[1].code} %</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-500">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from(new Set([
                      ...compareIngs[0].map((i: any) => i.raw_materials?.name || i.raw_material_id),
                      ...compareIngs[1].map((i: any) => i.raw_materials?.name || i.raw_material_id),
                    ])).map(name => {
                      const a = compareIngs[0].find((i: any) => (i.raw_materials?.name || i.raw_material_id) === name);
                      const b = compareIngs[1].find((i: any) => (i.raw_materials?.name || i.raw_material_id) === name);
                      const pctA = a ? Number(a.percentage) : 0;
                      const pctB = b ? Number(b.percentage) : 0;
                      const diff = pctB - pctA;
                      return (
                        <tr key={name} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-700">{name}</td>
                          <td className="px-4 py-2 text-center">
                            {pctA > 0 ? <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">{pctA.toFixed(1)}%</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {pctB > 0 ? <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">{pctB.toFixed(1)}%</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2 text-center text-xs font-medium">
                            {diff === 0 ? <span className="text-slate-400">0</span>
                              : diff > 0 ? <span className="text-emerald-600">+{diff.toFixed(1)}%</span>
                              : <span className="text-red-500">{diff.toFixed(1)}%</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setCompareOpen(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setBomEditMode(false); }} title={selected?.name || ''} size="xl">
        {selected && (
          <div className="space-y-5">
            <div className="flex gap-2">
              <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"><Edit2 className="w-3.5 h-3.5" /> Edit Formula</button>
              <button onClick={() => { setBomEditMode(!bomEditMode); setBomEditIngs([...detailIngs]); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"><Edit2 className="w-3.5 h-3.5" /> {bomEditMode ? 'Cancel BOM Edit' : 'Edit BOM'}</button>
              <button onClick={() => handleDelete(selected.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[['Code', selected.code], ['Category', selected.category], ['Version', `v${selected.version}`], ['Status', selected.status], ['Batch Size', `${selected.batch_size} ${selected.batch_unit}`], ['Cost/Unit', `$${selected.estimated_cost_per_unit.toFixed(2)}`], ['Protein', `${selected.target_protein}%`], ['Fat', `${selected.target_fat}%`]].map(([l, v]) => (
                <div key={l as string} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">{l}</p><p className="text-sm font-semibold text-slate-700">{v}</p></div>
              ))}
            </div>
            {selected.description && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{selected.description}</p>}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">Ingredients ({detailIngs.length})</h4>
                {bomEditMode && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Editing Mode</span>}
              </div>
              {detailIngs.length === 0 ? <p className="text-sm text-slate-400">No ingredients added</p> : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 text-left bg-slate-50">
                      <th className="px-3 py-2 font-medium text-slate-600">Material</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-right">Qty</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Unit</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-right">%</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-right">Unit Cost</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-right">Total Cost</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-right">Stock</th>
                      <th className="px-3 py-2 font-medium text-slate-600 text-center">Critical</th>
                    </tr></thead>
                    <tbody>{(bomEditMode ? bomEditIngs : detailIngs).map((i, idx) => {
                      const unitCost = i.raw_materials?.cost_per_unit || 0;
                      const totalCost = i.quantity * unitCost;
                      const currentStock = i.raw_materials?.current_stock || 0;
                      const stockStatus = currentStock >= i.quantity ? 'text-emerald-600' : currentStock > 0 ? 'text-amber-600' : 'text-red-600';
                      return (
                        <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700 font-medium">{i.raw_materials?.name || 'Unknown'}</td>
                          <td className="px-3 py-2 text-right">
                            {bomEditMode ? (
                              <input type="number" step="0.01" value={i.quantity} onChange={e => { const u = [...bomEditIngs]; u[idx] = { ...u[idx], quantity: parseFloat(e.target.value) || 0 }; setBomEditIngs(u); }} className="w-20 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" />
                            ) : (
                              <span>{i.quantity.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {bomEditMode ? (
                              <input type="text" value={i.unit} onChange={e => { const u = [...bomEditIngs]; u[idx] = { ...u[idx], unit: e.target.value }; setBomEditIngs(u); }} className="w-16 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" />
                            ) : (
                              <span>{i.unit}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {bomEditMode ? (
                              <input type="number" step="0.1" value={i.percentage} onChange={e => { const u = [...bomEditIngs]; u[idx] = { ...u[idx], percentage: parseFloat(e.target.value) || 0 }; setBomEditIngs(u); }} className="w-16 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" />
                            ) : (
                              <span>{i.percentage.toFixed(1)}%</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">${unitCost.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right text-slate-700 font-semibold">${totalCost.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${stockStatus}`}>{currentStock.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            {bomEditMode ? (
                              <input type="checkbox" checked={i.is_critical} onChange={e => { const u = [...bomEditIngs]; u[idx] = { ...u[idx], is_critical: e.target.checked }; setBomEditIngs(u); }} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            ) : (
                              <span>{i.is_critical ? <span className="text-xs font-medium text-red-600">●</span> : <span className="text-xs text-slate-300">○</span>}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
              {bomEditMode && (
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
                  <button onClick={() => setBomEditMode(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                  <button onClick={saveBomEdits} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save BOM Changes'}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editId ? 'Edit Formula' : 'New Formula'} size="xl">
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: 'Name', k: 'name', t: 'text' }, { l: 'Code', k: 'code', t: 'text' },
              { l: 'Sage Code', k: 'sage_code', t: 'text' }, { l: 'Batch Size', k: 'batch_size', t: 'number' },
              { l: 'Batch Unit', k: 'batch_unit', t: 'text' },
            ].map(({ l, k, t }) => (
              <div key={k}><label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                <input type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: t === 'number' ? Number(e.target.value) : e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder={l === 'Sage Code' ? 'e.g., HDC25, HDC10, HDC8' : ''} /></div>
            ))}
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{formatLabel(c)}</option>
                ))}
              </select></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white">
                <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
              </select></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" /></div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nutritional Targets</h4>
            <div className="grid grid-cols-4 gap-3">
              {[['Protein %', 'target_protein'], ['Fat %', 'target_fat'], ['Fiber %', 'target_fiber'], ['Moisture %', 'target_moisture']].map(([l, k]) => (
                <div key={k}><label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                  <input type="number" step="0.1" value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" /></div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingredients</h4>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${Math.abs(totalPct - 100) < 0.01 ? 'text-emerald-600' : totalPct > 100 ? 'text-red-600' : 'text-amber-600'}`}>Total: {totalPct.toFixed(1)}%</span>
                <button onClick={() => setIngs([...ings, emptyIng()])} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left">
                <th className="pb-2 font-medium text-slate-500 text-xs">Raw Material</th><th className="pb-2 font-medium text-slate-500 text-xs w-24">Qty</th><th className="pb-2 font-medium text-slate-500 text-xs w-20">Unit</th><th className="pb-2 font-medium text-slate-500 text-xs w-20">%</th><th className="pb-2 font-medium text-slate-500 text-xs w-16">Critical</th><th className="pb-2 w-10"></th>
              </tr></thead>
              <tbody>{ings.map((ing, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-1.5 pr-2">
                    <select value={ing.raw_material_id} onChange={e => { const u = [...ings]; u[idx] = { ...u[idx], raw_material_id: e.target.value, unit: materials.find(m => m.id === e.target.value)?.unit || ing.unit }; setIngs(u); }} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-teal-500">
                      <option value="">Select...</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                    </select></td>
                  <td className="py-1.5 pr-2"><input type="number" value={ing.quantity} onChange={e => { const u = [...ings]; u[idx] = { ...u[idx], quantity: Number(e.target.value) }; setIngs(u); }} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500" /></td>
                  <td className="py-1.5 pr-2"><input type="text" value={ing.unit} onChange={e => { const u = [...ings]; u[idx] = { ...u[idx], unit: e.target.value }; setIngs(u); }} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500" /></td>
                  <td className="py-1.5 pr-2"><input type="number" step="0.1" value={ing.percentage} onChange={e => { const u = [...ings]; u[idx] = { ...u[idx], percentage: Number(e.target.value) }; setIngs(u); }} className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-teal-500" /></td>
                  <td className="py-1.5 pr-2 text-center"><input type="checkbox" checked={ing.is_critical} onChange={e => { const u = [...ings]; u[idx] = { ...u[idx], is_critical: e.target.checked }; setIngs(u); }} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" /></td>
                  <td className="py-1.5"><button onClick={() => setIngs(ings.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.code} className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Formula'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}