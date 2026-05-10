import { TrendingDown, AlertCircle } from 'lucide-react';

const alerts = [
  { item: 'Axel Oil', level: 'Low', quantity: '8.2kg', status: 'critical' },
  { item: 'Barley', level: 'Low', quantity: '12kg', status: 'warning' },
  { item: 'Barley Grains', level: 'Low', quantity: '7.1kg', status: 'critical' },
  { item: 'Steel Coil Mod', level: 'Medium', quantity: '18,500 kg', status: 'normal' },
];

export function StockAlerts() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] text-gray-900 uppercase tracking-wide">Stock Alerts</h3>
        <span className="text-[11px] text-gray-400">12 items</span>
      </div>
      <div className="space-y-2.5">
        {alerts.map((alert, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                alert.status === 'critical' ? 'bg-red-500' :
                alert.status === 'warning' ? 'bg-amber-500' :
                'bg-gray-300'
              }`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-900 truncate">{alert.item}</p>
                <p className="text-[10px] text-gray-500">{alert.level}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[12px] text-gray-900">{alert.quantity}</p>
              {alert.status === 'critical' && (
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] text-red-500">Critical</span>
                </div>
              )}
              {alert.status === 'warning' && (
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] text-amber-500">Warning</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 text-[11px] text-gray-500 hover:text-gray-700 uppercase tracking-wide">
        View All Stock Items
      </button>
    </div>
  );
}
