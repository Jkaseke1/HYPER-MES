import { useNavigate } from 'react-router-dom';
import { Truck, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

const chickModules = [
  {
    title: 'Chick Bookings',
    description: 'Purchase orders, approvals, supplier invoices, and payment tracking for chick procurement.',
    icon: ClipboardList,
    to: '/chick-bookings',
    color: 'bg-emerald-500',
    stat: 'POs & Approvals',
  },
  {
    title: 'Chick Distribution',
    description: 'Weekly delivery schedules by route and customer. Replace the manual Excel spreadsheet.',
    icon: Truck,
    to: '/chick-distribution',
    color: 'bg-blue-500',
    stat: 'Weekly Schedules',
  },
];

export default function ChickHubPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Chick Management</h1>
        <p className="text-sm text-slate-500 mt-1">Purchase, delivery tracking, and weekly distribution</p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {chickModules.map((mod) => (
          <Card
            key={mod.to}
            className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md overflow-hidden"
            onClick={() => navigate(mod.to)}
          >
            <div className={`h-2 ${mod.color}`} />
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${mod.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <mod.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-800">{mod.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{mod.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{mod.stat}</span>
                    <span className="text-xs text-slate-300">|</span>
                    <span className="text-xs font-medium text-teal-600">Click to open &rarr;</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">Purchase Orders</p>
            <p className="text-xs text-slate-400 mt-1">Track supplier deliveries & payments</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase">Distribution</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">Weekly Grid</p>
            <p className="text-xs text-slate-400 mt-1">Plan daily deliveries by route</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium uppercase">Integration</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">Coming Soon</p>
            <p className="text-xs text-slate-400 mt-1">Link bookings to distribution</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
