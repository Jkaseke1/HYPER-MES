import { useState, useEffect } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';

export interface PackagingItem {
  item_code: string;
  description: string;
  unit: string;
  expected_qty: number;
}

export interface PackagingActual {
  item_code: string;
  description: string;
  unit: string;
  expected_qty: number;
  actual_qty: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (actuals: PackagingActual[], notes: string) => Promise<void>;
  bomPackagingItems: PackagingItem[];
  plannedQty: number;
  rateLabel: string;
  saving?: boolean;
}

export default function PackagingDeclarationModal({
  open,
  onClose,
  onConfirm,
  bomPackagingItems,
  plannedQty,
  rateLabel,
  saving = false,
}: Props) {
  const [actuals, setActuals] = useState<PackagingActual[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setActuals(bomPackagingItems.map(item => ({
        ...item,
        actual_qty: String(item.expected_qty),
      })));
      setNotes('');
    }
  }, [open, bomPackagingItems]);

  function updateActual(idx: number, value: string) {
    const updated = [...actuals];
    updated[idx] = { ...updated[idx], actual_qty: value };
    setActuals(updated);
  }

  return (
    <Modal open={open} onClose={onClose} title="Declare Packaging Used" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg p-3">
          <Package className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
          <p className="text-xs text-teal-800">
            Record the actual packaging consumed for this batch.
            {bomPackagingItems.length > 0 && (
              <> Expected quantities are pre-filled based on BOM rate ({rateLabel}).</>
            )}
          </p>
        </div>

        {actuals.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Expected</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-teal-700">Actual Used</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actuals.map((item, idx) => {
                  const actualNum = parseFloat(item.actual_qty);
                  const variance = !isNaN(actualNum) ? actualNum - item.expected_qty : null;
                  const hasVariance = variance !== null && Math.abs(variance) > 0;
                  return (
                    <tr key={item.item_code} className={hasVariance ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.item_code}</td>
                      <td className="px-3 py-2 text-slate-700">{item.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {item.expected_qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.actual_qty}
                          onChange={e => updateActual(idx, e.target.value)}
                          className="w-24 text-right border border-teal-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none bg-teal-50"
                        />
                        {hasVariance && (
                          <span className={`ml-1 text-xs ${variance! > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                            {variance! > 0 ? '+' : ''}{variance!.toFixed(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">{item.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-600">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              No packaging items defined on this BOM
            </div>
            <p className="text-xs text-slate-400">Add packaging items to the BOM to track expected vs actual consumption. You can still add notes below.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Packaging Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            placeholder="Any packaging-related notes..."
          />
        </div>

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onConfirm(actuals, notes)}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Completing...' : 'Confirm & Complete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
