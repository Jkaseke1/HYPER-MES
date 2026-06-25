import { useState } from 'react';
import { ChevronDown, ChevronUp, Scale, AlertTriangle, CheckCircle, Truck, User } from 'lucide-react';

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
  receivedQty?: number;
  hideHeader?: boolean;
}

const input =
  'w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 transition-colors bg-slate-800 text-white placeholder:text-slate-500 [color-scheme:dark]';
const label = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1';

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{title}</label>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 bg-slate-700 rounded-md flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-teal-400" />
      </div>
      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{children}</span>
      <div className="flex-1 border-t border-slate-700" />
    </div>
  );
}

export default function WeighBridgeTicket({ data, onChange, receivedQty, hideHeader }: WeighBridgeTicketProps) {
  const [expanded, setExpanded] = useState(!!hideHeader);

  const handleMassChange = (field: 'wb_first_mass' | 'wb_second_mass', value: string) => {
    onChange(field, value);
    const first = field === 'wb_first_mass' ? parseFloat(value) : parseFloat(data.wb_first_mass);
    const second = field === 'wb_second_mass' ? parseFloat(value) : parseFloat(data.wb_second_mass);
    if (!isNaN(first) && !isNaN(second)) {
      onChange('wb_nett_mass', String(Math.round(Math.abs(second - first) * 1000) / 1000));
    }
  };

  const nettMass = parseFloat(data.wb_nett_mass);
  const variance =
    !isNaN(nettMass) && nettMass > 0 && receivedQty
      ? Math.abs((nettMass - receivedQty) / nettMass) * 100
      : null;
  const hasWBData = !!data.wb_transaction_no;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        expanded ? 'border-teal-500/50 shadow-lg shadow-teal-900/10' : 'border-slate-700'
      } overflow-hidden`}
    >
      {/* ── Header ── */}
      {!hideHeader && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between px-5 py-3 transition-colors ${
            expanded ? 'bg-slate-800' : 'bg-slate-800/50 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${expanded ? 'bg-teal-500' : 'bg-slate-700'}`}>
              <Scale className={`w-4 h-4 ${expanded ? 'text-white' : 'text-slate-400'}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${expanded ? 'text-white' : 'text-slate-300'}`}>
                Weigh Bridge Ticket
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasWBData ? `Ref: ${data.wb_transaction_no}` : 'Optional — expand to capture weighing data'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasWBData && !expanded && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-500/20 text-teal-400 rounded-full border border-teal-500/30">
                Captured
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-teal-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>
      )}

      {/* ── Body ── */}
      {expanded && (
        <div className="bg-slate-900 px-5 pb-5 pt-4 space-y-4">

          {/* Variance Warning */}
          {variance !== null && variance > 2 && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <span className="font-bold">Variance Alert — </span>
                Nett mass ({data.wb_nett_mass} kg) differs from received quantity ({receivedQty} kg) by{' '}
                <span className="font-bold">{variance.toFixed(1)}%</span>. Verify before saving.
              </p>
            </div>
          )}

          {/* ── Two Column Layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Left: Vehicle & Driver */}
            <div className="space-y-4">
              {/* Vehicle Section */}
              <div>
                <SectionHeader icon={Truck}>Vehicle & Reference</SectionHeader>
                <div className="grid grid-cols-3 gap-2.5">
                  <Field title="Transaction No">
                    <input
                      type="text"
                      value={data.wb_transaction_no}
                      onChange={(e) => onChange('wb_transaction_no', e.target.value)}
                      placeholder="e.g. WB-00123"
                      className={input}
                    />
                  </Field>
                  <Field title="Vehicle Reg">
                    <input
                      type="text"
                      value={data.wb_vehicle_reg}
                      onChange={(e) => onChange('wb_vehicle_reg', e.target.value)}
                      placeholder="e.g. ABC 123 GP"
                      className={input}
                    />
                  </Field>
                  <Field title="Haulier">
                    <select
                      value={data.wb_haulier_code}
                      onChange={(e) => onChange('wb_haulier_code', e.target.value)}
                      className={input}
                    >
                      <option value="">Select…</option>
                      <option value="HYPER">HYPER</option>
                      <option value="External">External</option>
                    </select>
                  </Field>
                  <Field title="Product Code">
                    <input
                      type="text"
                      value={data.wb_product_code}
                      onChange={(e) => onChange('wb_product_code', e.target.value)}
                      placeholder="From line item"
                      className={input}
                    />
                  </Field>
                  <Field title="Trailer No">
                    <input
                      type="text"
                      value={data.wb_trailer_number}
                      onChange={(e) => onChange('wb_trailer_number', e.target.value)}
                      placeholder="Trailer number"
                      className={input}
                    />
                  </Field>
                  <Field title="Comment">
                    <input
                      type="text"
                      value={data.wb_comment}
                      onChange={(e) => onChange('wb_comment', e.target.value)}
                      placeholder="Optional note"
                      className={input}
                    />
                  </Field>
                </div>
              </div>

              {/* Driver Section */}
              <div>
                <SectionHeader icon={User}>Driver</SectionHeader>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field title="Driver Name">
                    <input
                      type="text"
                      value={data.wb_driver_name}
                      onChange={(e) => onChange('wb_driver_name', e.target.value)}
                      placeholder="Full name"
                      className={input}
                    />
                  </Field>
                  <Field title="Driver ID / Licence">
                    <input
                      type="text"
                      value={data.wb_driver_id}
                      onChange={(e) => onChange('wb_driver_id', e.target.value)}
                      placeholder="ID or licence number"
                      className={input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Right: Weighing */}
            <div className="space-y-4">
              <SectionHeader icon={Scale}>Weighing</SectionHeader>

              {/* Entry / Exit side by side */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 space-y-2.5">
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Entry — 1st Weighing</p>
                  <Field title="Time In">
                    <input
                      type="datetime-local"
                      value={data.wb_time_in}
                      onChange={(e) => onChange('wb_time_in', e.target.value)}
                      className={input}
                    />
                  </Field>
                  <Field title="1st Mass (kg)">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={data.wb_first_mass}
                      onChange={(e) => handleMassChange('wb_first_mass', e.target.value)}
                      placeholder="0.000"
                      className={input}
                    />
                  </Field>
                </div>

                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 space-y-2.5">
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Exit — 2nd Weighing</p>
                  <Field title="Time Out">
                    <input
                      type="datetime-local"
                      value={data.wb_time_out}
                      onChange={(e) => onChange('wb_time_out', e.target.value)}
                      className={input}
                    />
                  </Field>
                  <Field title="2nd Mass (kg)">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={data.wb_second_mass}
                      onChange={(e) => handleMassChange('wb_second_mass', e.target.value)}
                      placeholder="0.000"
                      className={input}
                    />
                  </Field>
                </div>
              </div>

              {/* Nett Mass + Driver Signed */}
              <div className="flex items-stretch gap-2.5">
                <div className="flex-1 p-3 rounded-lg bg-teal-900/40 border border-teal-500/30">
                  <label className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1">
                    Nett Mass (kg) — Auto
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={data.wb_nett_mass}
                    onChange={(e) => onChange('wb_nett_mass', e.target.value)}
                    placeholder="Auto-calculated"
                    className="w-full px-3 py-2 border border-teal-500/40 rounded-lg text-lg font-bold text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-400 bg-slate-800"
                  />
                </div>

                <div className="flex flex-col items-center justify-center gap-1.5 px-5 rounded-lg border border-slate-700 bg-slate-800 min-w-[120px]">
                  <label className="flex flex-col items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={data.wb_driver_signed}
                      onChange={(e) => onChange('wb_driver_signed', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${
                        data.wb_driver_signed ? 'bg-teal-500' : 'bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          data.wb_driver_signed ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">Driver Signed</span>
                  </label>
                  {data.wb_driver_signed && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-teal-400">
                      <CheckCircle className="w-3 h-3" />
                      Signed
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
