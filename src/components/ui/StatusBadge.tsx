const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  inspecting: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
  materials_issued: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  loading: 'bg-amber-50 text-amber-700 border-amber-200',
  dispatched: 'bg-blue-50 text-blue-700 border-blue-200',
  in_transit: 'bg-teal-50 text-teal-700 border-teal-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  conditional: 'bg-amber-50 text-amber-700 border-amber-200',
  operational: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  breakdown: 'bg-red-50 text-red-700 border-red-200',
  decommissioned: 'bg-slate-50 text-slate-500 border-slate-200',
  archived: 'bg-slate-50 text-slate-500 border-slate-200',
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border-red-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${style} ${className}`}
    >
      {label}
    </span>
  );
}
