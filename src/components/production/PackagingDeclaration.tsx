import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Loader2 } from 'lucide-react';
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
  onSave: (lines: PackagingLine[]) => Promise<void>;
  disabled?: boolean;
}

export default function PackagingDeclaration({
  actualOutputQty,
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
  }, []);

  async function fetchSkus() {
    try {
      const { data, error: err } = await supabase
        .from('packaging_skus')
        .select('*')
        .eq('is_active', true)
        .order('sku_code');

      if (err) throw err;
      setSkus(data || []);
    } catch (err) {
      console.error('Failed to fetch packaging SKUs:', err);
      setError('Failed to load packaging SKUs');
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([
      ...lines,
      {
        id: `temp-${Date.now()}`,
        packaging_sku_id: '',
        bags_used: 0,
        implied_tonnes: 0,
      },
    ]);
  }

  function removeLine(id: string) {
    setLines(lines.filter((l) => l.id !== id));
  }

  function updateLine(id: string, field: keyof PackagingLine, value: any) {
    setLines(
      lines.map((l) => {
        if (l.id !== id) return l;

        const updated = { ...l, [field]: value };

        // Calculate implied tonnes if bags_used or packaging_sku_id changed
        if (field === 'bags_used' || field === 'packaging_sku_id') {
          const sku = skus.find((s) => s.id === updated.packaging_sku_id);
          if (sku && updated.bags_used > 0) {
            updated.implied_tonnes = (updated.bags_used * sku.bag_size_kg) / 1000;
          } else {
            updated.implied_tonnes = 0;
          }
        }

        return updated;
      })
    );
  }

  // Calculate total implied tonnes
  const totalImpliedTonnes = lines.reduce((sum, l) => sum + l.implied_tonnes, 0);

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
      setError('All packaging lines must have a SKU and quantity > 0');
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Packaging Declaration</h3>
        <p className="text-xs text-slate-500 mb-4">
          Declare packaging used for this batch. Implied production will be calculated and compared to actual output.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded border border-slate-200">
        <div>
          <p className="text-xs text-slate-500">Actual Output</p>
          <p className="text-sm font-semibold text-slate-800">{actualOutputQty.toFixed(2)} t</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Implied from Packaging</p>
          <p className="text-sm font-semibold text-slate-800">{totalImpliedTonnes.toFixed(2)} t</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Variance</p>
          <p
            className={`text-sm font-semibold ${
              showVarianceWarning ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {variance.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Variance Warning */}
      {showVarianceWarning && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Variance exceeds 2%. Implied production ({totalImpliedTonnes.toFixed(2)}t) differs significantly from actual output ({actualOutputQty.toFixed(2)}t).
          </p>
        </div>
      )}

      {/* Packaging Lines */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No packaging declared yet</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="grid grid-cols-5 gap-2 p-2 bg-white rounded border border-slate-200">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Packaging SKU</label>
                <select
                  value={line.packaging_sku_id}
                  onChange={(e) => updateLine(line.id, 'packaging_sku_id', e.target.value)}
                  disabled={disabled || saving}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">Select SKU</option>
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.sku_code} — {sku.description} ({sku.bag_size_kg}kg)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bags Used</label>
                <input
                  type="number"
                  min="1"
                  value={line.bags_used || ''}
                  onChange={(e) => updateLine(line.id, 'bags_used', parseInt(e.target.value) || 0)}
                  disabled={disabled || saving}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Implied (t)</label>
                <div className="px-2 py-1.5 bg-slate-100 rounded text-sm font-medium text-slate-700">
                  {line.implied_tonnes.toFixed(3)}
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => removeLine(line.id)}
                  disabled={disabled || saving}
                  className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Line Button */}
      <button
        onClick={addLine}
        disabled={disabled || saving || lines.length === 0 && skus.length === 0}
        className="w-full px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded border border-teal-200 font-medium transition-colors disabled:opacity-50"
      >
        <Plus className="w-4 h-4 inline mr-1" />
        Add Packaging Line
      </button>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={disabled || saving || lines.length === 0}
        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Confirm Packaging Declaration'}
      </button>
    </div>
  );
}
