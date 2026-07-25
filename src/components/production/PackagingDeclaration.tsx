import { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle2, Plus, Trash2, Loader2, Sparkles, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PackagingSKU {
  id: string;
  sku_code: string;
  description: string;
  bag_size_kg: number;
  is_active: boolean;
}

interface PackagingLine {
  id: string;
  packaging_sku_id: string;
  bags_used: number;
  implied_tonnes: number;
}

interface PackagingDeclarationProps {
  actualOutputQty: number; // in tonnes
  formulationId?: string;
  onSave: (lines: PackagingLine[]) => Promise<void>;
  disabled?: boolean;
}

export default function PackagingDeclaration({
  actualOutputQty,
  formulationId,
  onSave,
  disabled = false
}: PackagingDeclarationProps) {
  const [skus, setSkus] = useState<PackagingSKU[]>([]);
  const [lines, setLines] = useState<PackagingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSkus();
  }, [actualOutputQty, formulationId]);

  async function fetchSkus() {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('packaging_skus')
        .select('*')
        .eq('is_active', true)
        .order('bag_size_kg', { ascending: false });

      if (err) throw err;
      const available = data || [];
      setSkus(available);
      await autoPopulateLines(available);
    } catch (err) {
      console.error('Failed to fetch packaging SKUs:', err);
      setError('Failed to load packaging SKUs');
    } finally {
      setLoading(false);
    }
  }

  async function autoPopulateLines(availableSkus: PackagingSKU[]) {
    if (availableSkus.length === 0) return;

    const initial: PackagingLine[] = [];
    const outputInKg = Math.max(0, actualOutputQty * 1000);

    // 1. Try to match formulation BOM packaging items
    if (formulationId) {
      try {
        const { data: bomItems, error: bomErr } = await supabase
          .from('production_bom_packaging')
          .select('*')
          .eq('formulation_id', formulationId);

        if (!bomErr && bomItems && bomItems.length > 0) {
          for (const item of bomItems) {
            const sku = availableSkus.find(
              (s) =>
                s.id === item.packaging_sku_id ||
                s.sku_code?.toLowerCase() === (item.item_code || '').toLowerCase()
            );

            if (sku && sku.bag_size_kg > 0) {
              const bags = outputInKg > 0 ? Math.max(1, Math.round(outputInKg / sku.bag_size_kg)) : 0;
              initial.push({
                id: `bom-${sku.id}-${Date.now()}-${Math.random()}`,
                packaging_sku_id: sku.id,
                bags_used: bags,
                implied_tonnes: (bags * sku.bag_size_kg) / 1000,
              });
            }
          }
        }
      } catch (err) {
        console.error('BOM packaging lookup failed:', err);
      }
    }

    // 2. Fallback: auto-pick the best matching SKU (e.g., 50kg or 25kg bag)
    if (initial.length === 0) {
      const defaultSku = availableSkus.find((s) => s.bag_size_kg > 0) || availableSkus[0];
      if (defaultSku && defaultSku.bag_size_kg > 0) {
        const bags = outputInKg > 0 ? Math.max(1, Math.round(outputInKg / defaultSku.bag_size_kg)) : 0;
        initial.push({
          id: `default-${defaultSku.id}-${Date.now()}`,
          packaging_sku_id: defaultSku.id,
          bags_used: bags,
          implied_tonnes: (bags * defaultSku.bag_size_kg) / 1000,
        });
      }
    }

    if (initial.length > 0) {
      setLines(initial);
    }
  }

  function updateLine(id: string, field: keyof PackagingLine, value: any) {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;

        const updated = { ...l, [field]: value };

        if (field === 'packaging_sku_id') {
          const sku = skus.find((s) => s.id === updated.packaging_sku_id);
          if (sku && sku.bag_size_kg > 0) {
            if (actualOutputQty > 0) {
              updated.bags_used = Math.max(1, Math.round((actualOutputQty * 1000) / sku.bag_size_kg));
            }
            updated.implied_tonnes = (updated.bags_used * sku.bag_size_kg) / 1000;
          } else {
            updated.implied_tonnes = 0;
          }
        }

        if (field === 'bags_used') {
          const sku = skus.find((s) => s.id === updated.packaging_sku_id);
          if (sku && sku.bag_size_kg > 0) {
            updated.implied_tonnes = (updated.bags_used * sku.bag_size_kg) / 1000;
          } else {
            updated.implied_tonnes = 0;
          }
        }

        return updated;
      })
    );
  }

  function addLine() {
    const defaultSku = skus.find((s) => s.bag_size_kg > 0) || skus[0];
    if (!defaultSku) return;

    const bags = actualOutputQty > 0 ? Math.max(1, Math.round((actualOutputQty * 1000) / defaultSku.bag_size_kg)) : 0;
    setLines([
      ...lines,
      {
        id: `custom-${Date.now()}`,
        packaging_sku_id: defaultSku.id,
        bags_used: bags,
        implied_tonnes: (bags * defaultSku.bag_size_kg) / 1000,
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return;
    setLines(lines.filter((l) => l.id !== id));
  }

  // Calculate total implied tonnes
  const totalImpliedTonnes = lines.reduce((sum, l) => sum + l.implied_tonnes, 0);

  // Calculate total bags
  const totalBags = lines.reduce((sum, l) => sum + (l.bags_used || 0), 0);

  // Calculate variance percentage
  const variance =
    actualOutputQty > 0
      ? Math.abs((totalImpliedTonnes - actualOutputQty) / actualOutputQty) * 100
      : 0;

  const showVarianceWarning = variance > 2;

  async function handleSave() {
    if (lines.length === 0) {
      setError('At least one packaging SKU must be declared');
      return;
    }

    const invalidLine = lines.find((l) => !l.packaging_sku_id || l.bags_used <= 0);
    if (invalidLine) {
      setError('All packaging lines must have a valid SKU and bag count > 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(lines);
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err.message || 'Failed to save packaging declaration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
        <p className="text-sm font-medium">Loading packaging SKUs & auto-populating bags...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold tracking-tight">Declare Packaging Used</h3>
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Sparkles className="w-3 h-3" /> Auto-Calculated
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Bags are auto-calculated from declared actual output ({actualOutputQty.toFixed(3)} tonnes). Verify before completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actual Output</span>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">{actualOutputQty.toFixed(3)} <span className="text-xs font-normal text-slate-500">tonnes</span></p>
          <span className="text-[10px] text-slate-400 font-mono">{(actualOutputQty * 1000).toLocaleString()} kg</span>
        </div>
        <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Auto Bag Count</span>
          <p className="text-lg font-extrabold text-emerald-900 mt-0.5">{totalBags.toLocaleString()} <span className="text-xs font-normal text-emerald-600">bags</span></p>
          <span className="text-[10px] text-emerald-600 font-mono">Implied: {totalImpliedTonnes.toFixed(3)} t</span>
        </div>
        <div className={`p-3.5 border rounded-xl ${showVarianceWarning ? 'bg-amber-50 border-amber-200' : 'bg-blue-50/50 border-blue-200'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${showVarianceWarning ? 'text-amber-700' : 'text-blue-700'}`}>Output Variance</span>
          <p className={`text-lg font-extrabold mt-0.5 ${showVarianceWarning ? 'text-amber-900' : 'text-blue-900'}`}>
            {variance.toFixed(1)}%
          </p>
          <span className={`text-[10px] ${showVarianceWarning ? 'text-amber-600' : 'text-blue-600'}`}>
            {showVarianceWarning ? 'Differs > 2%' : 'Within tolerance'}
          </span>
        </div>
      </div>

      {/* Variance Warning Alert */}
      {showVarianceWarning && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">Packaging Variance Alert:</span> Implied output from declared bags ({totalImpliedTonnes.toFixed(3)}t) differs by {variance.toFixed(1)}% from actual output ({actualOutputQty.toFixed(3)}t). Please check bag quantities.
          </div>
        </div>
      )}

      {/* Packaging Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Packaging Lines & SKUs</label>
          <button
            type="button"
            onClick={addLine}
            disabled={disabled || saving}
            className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add SKU Line
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-amber-600 font-medium">No packaging SKUs configured. Click "Add SKU Line" above.</p>
          </div>
        ) : (
          lines.map((line, idx) => {
            const currentSku = skus.find((s) => s.id === line.packaging_sku_id);
            return (
              <div key={line.id} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-600 font-mono">Line #{idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title="Remove Line"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">Packaging SKU</label>
                    <select
                      value={line.packaging_sku_id}
                      onChange={(e) => updateLine(line.id, 'packaging_sku_id', e.target.value)}
                      disabled={disabled || saving}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                    >
                      <option value="">Select Packaging SKU...</option>
                      {skus.map((sku) => (
                        <option key={sku.id} value={sku.id}>
                          {sku.sku_code} — {sku.description} ({sku.bag_size_kg} kg/bag)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-[11px] font-bold text-emerald-700 uppercase">Bags Used</label>
                    <input
                      type="number"
                      min="1"
                      value={line.bags_used || ''}
                      onChange={(e) => updateLine(line.id, 'bags_used', parseInt(e.target.value) || 0)}
                      disabled={disabled || saving}
                      className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-emerald-50/50 text-emerald-900"
                      placeholder="0"
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">Implied Output</label>
                    <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800">
                      {line.implied_tonnes.toFixed(3)} tonnes
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Completion Action */}
      <button
        onClick={handleSave}
        disabled={disabled || saving || lines.length === 0}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Completing Order & Posting Sync...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" /> Approve Packaging & Complete Production Order
          </>
        )}
      </button>
    </div>
  );
}
