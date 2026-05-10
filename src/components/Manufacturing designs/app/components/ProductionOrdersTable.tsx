import { Search, Filter, MoreVertical, CheckCircle, Clock, AlertCircle, ChevronDown } from 'lucide-react';

const orders = [
  { id: 'PO-2026-0847', material: 'Steel Frame Assembly', qty: 500, completed: 387, status: 'In Progress', plant: '1000', startDate: '2026-05-08', endDate: '2026-05-12', progress: 77 },
  { id: 'PO-2026-0846', material: 'Motor Housing Unit', qty: 250, completed: 250, status: 'Completed', plant: '1000', startDate: '2026-05-05', endDate: '2026-05-09', progress: 100 },
  { id: 'PO-2026-0845', material: 'Hydraulic Pump V3', qty: 180, completed: 0, status: 'Released', plant: '1000', startDate: '2026-05-10', endDate: '2026-05-15', progress: 0 },
  { id: 'PO-2026-0844', material: 'Gearbox Casing', qty: 320, completed: 142, status: 'In Progress', plant: '2000', startDate: '2026-05-07', endDate: '2026-05-11', progress: 44 },
  { id: 'PO-2026-0843', material: 'Control Panel PCB', qty: 600, completed: 523, status: 'In Progress', plant: '1000', startDate: '2026-05-06', endDate: '2026-05-10', progress: 87 },
  { id: 'PO-2026-0842', material: 'Bearing Assembly', qty: 450, completed: 0, status: 'Created', plant: '1000', startDate: '2026-05-12', endDate: '2026-05-16', progress: 0 },
];

export function ProductionOrdersTable() {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-300 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5 min-w-[300px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              className="flex-1 text-[12px] outline-none bg-transparent"
            />
          </div>
          <button className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-[12px] text-gray-700 rounded flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          <select className="px-3 py-1.5 bg-white border border-gray-300 text-[12px] text-gray-700 rounded">
            <option>All Plants</option>
            <option>Plant 1000</option>
            <option>Plant 2000</option>
          </select>
          <select className="px-3 py-1.5 bg-white border border-gray-300 text-[12px] text-gray-700 rounded">
            <option>All Statuses</option>
            <option>Created</option>
            <option>Released</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>
        </div>
        <div className="text-[11px] text-gray-600">
          {orders.length} orders found
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
                <input type="checkbox" className="mr-2" />
                Order No.
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Material Description</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Plant</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Target Qty</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Completed</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Progress</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Start Date</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">End Date</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr
                key={order.id}
                className={`border-b border-gray-200 hover:bg-blue-50 cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-4 py-2.5">
                  <input type="checkbox" className="mr-2" />
                  <span className="text-[#3498db] hover:underline">{order.id}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-800">{order.material}</td>
                <td className="px-4 py-2.5 text-gray-600">{order.plant}</td>
                <td className="px-4 py-2.5 text-right text-gray-800">{order.qty.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-800">{order.completed.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                      <div
                        className={`h-full ${
                          order.progress === 100 ? 'bg-green-500' :
                          order.progress > 50 ? 'bg-blue-500' :
                          order.progress > 0 ? 'bg-amber-500' :
                          'bg-gray-300'
                        }`}
                        style={{ width: `${order.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-gray-600 w-10">{order.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                      order.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Released' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {order.status === 'Completed' && <CheckCircle className="w-3 h-3" />}
                    {order.status === 'In Progress' && <Clock className="w-3 h-3" />}
                    {order.status === 'Released' && <AlertCircle className="w-3 h-3" />}
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{order.startDate}</td>
                <td className="px-4 py-2.5 text-gray-600">{order.endDate}</td>
                <td className="px-4 py-2.5 text-center">
                  <button className="hover:bg-gray-200 p-1 rounded">
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}
      <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 flex items-center justify-between text-[11px] text-gray-600">
        <div>Showing 1 to {orders.length} of {orders.length} entries</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded">Previous</button>
          <button className="px-3 py-1 bg-[#3498db] text-white border border-[#3498db] rounded">1</button>
          <button className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded">2</button>
          <button className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded">Next</button>
        </div>
      </div>
    </div>
  );
}
