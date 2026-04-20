import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface WeighBridgeData {
  wb_transaction_no: string;
  wb_vehicle_reg: string;
  wb_haulier_code: string;
  wb_product_code: string;
  wb_comment: string;
  wb_trailer_number: string;
  wb_driver_name: string;
  wb_driver_id: string;
  wb_time_in: string;
  wb_first_mass: string;
  wb_time_out: string;
  wb_second_mass: string;
  wb_nett_mass: string;
  wb_driver_signed: boolean;
}

interface WeighBridgeTicketProps {
  data: WeighBridgeData;
  onChange: (field: keyof WeighBridgeData, value: any) => void;
  productCode?: string;
  receivedQty?: number;
  showWarning?: boolean;
}

export default function WeighBridgeTicket({
  data,
  onChange,
  productCode,
  receivedQty,
  showWarning = false,
}: WeighBridgeTicketProps) {
  const [expanded, setExpanded] = useState(false);

  // Auto-calculate nett mass
  const handleMassChange = (field: 'wb_first_mass' | 'wb_second_mass', value: string) => {
    const numValue = value === '' ? '' : parseFloat(value);
    onChange(field, numValue);

    // Auto-calculate nett mass if both masses are set
    if (field === 'wb_first_mass' && data.wb_second_mass !== '') {
      const secondMass = typeof data.wb_second_mass === 'string' ? parseFloat(data.wb_second_mass) : data.wb_second_mass;
      const firstMass = typeof numValue === 'string' ? parseFloat(numValue) : numValue;
      if (!isNaN(firstMass) && !isNaN(secondMass)) {
        const nettMass = Math.abs(secondMass - firstMass);
        onChange('wb_nett_mass', Math.round(nettMass * 1000) / 1000);
      }
    } else if (field === 'wb_second_mass' && data.wb_first_mass !== '') {
      const firstMass = typeof data.wb_first_mass === 'string' ? parseFloat(data.wb_first_mass) : data.wb_first_mass;
      const secondMass = typeof numValue === 'string' ? parseFloat(numValue) : numValue;
      if (!isNaN(firstMass) && !isNaN(secondMass)) {
        const nettMass = Math.abs(secondMass - firstMass);
        onChange('wb_nett_mass', Math.round(nettMass * 1000) / 1000);
      }
    }
  };

  // Calculate variance percentage
  const calculateVariance = () => {
    if (!data.wb_nett_mass || !receivedQty || receivedQty === 0) return null;
    const nettMass = typeof data.wb_nett_mass === 'string' ? parseFloat(data.wb_nett_mass) : data.wb_nett_mass;
    if (isNaN(nettMass)) return null;
    const variance = Math.abs((nettMass - receivedQty) / nettMass) * 100;
    return variance;
  };

  const variance = calculateVariance();
  const showVarianceWarning = variance !== null && variance > 2;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <h4 className="text-sm font-semibold text-slate-700">Weigh Bridge Ticket Details</h4>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* Variance Warning */}
          {showVarianceWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Variance Alert:</strong> Weigh bridge nett mass ({data.wb_nett_mass}kg) differs from received quantity ({receivedQty}kg) by {variance?.toFixed(1)}%. Please verify before saving.
              </p>
            </div>
          )}

          {/* Row 1: Transaction No, Vehicle Reg, Haulier Code */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Transaction No *
              </label>
              <input
                type="text"
                value={data.wb_transaction_no}
                onChange={(e) => onChange('wb_transaction_no', e.target.value)}
                placeholder="Main ticket reference"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Vehicle Reg
              </label>
              <input
                type="text"
                value={data.wb_vehicle_reg}
                onChange={(e) => onChange('wb_vehicle_reg', e.target.value)}
                placeholder="e.g. ABC123"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Haulier Code
              </label>
              <select
                value={data.wb_haulier_code}
                onChange={(e) => onChange('wb_haulier_code', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="HYPER">HYPER</option>
                <option value="External">External</option>
              </select>
            </div>
          </div>

          {/* Row 2: Product Code, Comment, Trailer Number */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Product Code
              </label>
              <input
                type="text"
                value={data.wb_product_code}
                onChange={(e) => onChange('wb_product_code', e.target.value)}
                placeholder={productCode || 'From line item'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Comment
              </label>
              <input
                type="text"
                value={data.wb_comment}
                onChange={(e) => onChange('wb_comment', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Trailer Number
              </label>
              <input
                type="text"
                value={data.wb_trailer_number}
                onChange={(e) => onChange('wb_trailer_number', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Row 3: Driver Name, Driver ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={data.wb_driver_name}
                onChange={(e) => onChange('wb_driver_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Driver ID
              </label>
              <input
                type="text"
                value={data.wb_driver_id}
                onChange={(e) => onChange('wb_driver_id', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Row 4: Time In, 1st Mass */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Time In
              </label>
              <input
                type="datetime-local"
                value={data.wb_time_in}
                onChange={(e) => onChange('wb_time_in', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                1st Mass (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={data.wb_first_mass}
                onChange={(e) => handleMassChange('wb_first_mass', e.target.value)}
                placeholder="0.000"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Row 5: Time Out, 2nd Mass */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Time Out
              </label>
              <input
                type="datetime-local"
                value={data.wb_time_out}
                onChange={(e) => onChange('wb_time_out', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                2nd Mass (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={data.wb_second_mass}
                onChange={(e) => handleMassChange('wb_second_mass', e.target.value)}
                placeholder="0.000"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Row 6: Nett Mass, Driver Signed */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nett Mass (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={data.wb_nett_mass}
                onChange={(e) => onChange('wb_nett_mass', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Auto-calculated"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.wb_driver_signed}
                  onChange={(e) => onChange('wb_driver_signed', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-slate-600">Driver Signed</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
