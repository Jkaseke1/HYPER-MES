import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

const data = [
  { hour: '00:00', output: 245, efficiency: 78, target: 300 },
  { hour: '02:00', output: 268, efficiency: 82, target: 300 },
  { hour: '04:00', output: 289, efficiency: 88, target: 300 },
  { hour: '06:00', output: 312, efficiency: 92, target: 300 },
  { hour: '08:00', output: 334, efficiency: 95, target: 300 },
  { hour: '10:00', output: 318, efficiency: 91, target: 300 },
  { hour: '12:00', output: 295, efficiency: 87, target: 300 },
  { hour: '14:00', output: 307, efficiency: 90, target: 300 },
];

export function OperationsTrends() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[13px] text-gray-900 uppercase tracking-wide">Operations Trends</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Last 14 hours</p>
        </div>
        <div className="flex items-center gap-5 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#00d4aa] rounded-sm"></div>
            <span className="text-gray-500">Output</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
            <span className="text-gray-500">Efficiency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-0.5 bg-gray-300"></div>
            <span className="text-gray-500">Target</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="hour"
            stroke="#9ca3af"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
          <Bar dataKey="output" fill="#00d4aa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="efficiency" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="target" stroke="#d1d5db" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
