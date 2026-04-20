import { useState } from 'react';
import { ChevronDown, ChevronUp, Scale, AlertTriangle, CheckCircle } from 'lucide-react';

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
}

const input =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-colors bg-white placeholder:text-slate-300';
const label = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{title}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{children}</span>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

export default function WeighBridgeTicket({ data, onChange, receivedQty }: WeighBridgeTicketProps) {
  const [expanded, setExpanded] = useState(false);

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
      className={`rounded-xl border-2 transition-all duration-200 ${
        expanded ? 'border-teal-200 shadow-sm' : 'border-slate-200'
      } overflow-hidden`}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${
          expanded ? 'bg-teal-50' : 'bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${expanded ? 'bg-teal-100' : 'bg-white border border-slate-200'}`}>
            <Scale className={`w-4 h-4 ${expanded ? 'text-teal-600' : 'text-slate-400'}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-semibold ${expanded ? 'text-teal-700' : 'text-slate-700'}`}>
              Weigh Bridge Ticket
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasWBData ? `Ref: ${data.wb_transaction_no}` : 'Optional — expand to capture weighing data'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasWBData && !expanded && (
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700 rounded-full">
              Captured
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-teal-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-300" />
          )}
        </div>
      </button>

      {/* ── Body ── */}
      {expanded && (
        <div className="bg-white px-5 pb-5 pt-4 space-y-5">

          {/* Variance Warning */}
          {variance !== null && variance > 2 && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-bold">Variance Alert — </span>
                Nett mass ({data.wb_nett_mass} kg) differs from received quantity ({receivedQty} kg) by{' '}
                <span className="font-bold">{variance.toFixed(1)}%</span>. Verify before saving.
              </p>
            </div>
          )}

          {/* ── Section 1: Ticket Reference ── */}
          <div>
            <SectionTitle>Ticket Reference</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
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
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
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

          {/* ── Section 2: Driver ── */}
          <div>
            <SectionTitle>Driver</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
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

          {/* ── Section 3: Weighing ── */}
          <div>
            <SectionTitle>Weighing</SectionTitle>

            {/* Entry / Exit cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entry — 1st Weighing</p>
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

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exit — 2nd Weighing</p>
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
            <div className="mt-3 flex items-stretch gap-3">
              {/* Nett Mass */}
              <div className="flex-1 p-4 rounded-xl bg-teal-50 border border-teal-200">
                <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-1.5">
                  Nett Mass (kg) — Auto-calculated
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={data.wb_nett_mass}
                  onChange={(e) => onChange('wb_nett_mass', e.target.value)}
                  placeholder="Populated automatically"
                  className="w-full px-3 py-2.5 border border-teal-300 rounded-lg text-lg font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 bg-white"
                />
              </div>

              {/* Driver Signed */}
              <div className="flex flex-col items-center justify-center gap-2 px-6 rounded-xl border border-slate-200 bg-slate-50 min-w-[130px]">
                <label className="flex flex-col items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={data.wb_driver_signed}
                    onChange={(e) => onChange('wb_driver_signed', e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${
                      data.wb_driver_signed ? 'bg-teal-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        data.wb_driver_signed ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Driver Signed</span>
                </label>
                {data.wb_driver_signed && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                    <CheckCircle className="w-3 h-3" />
                    Signed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
