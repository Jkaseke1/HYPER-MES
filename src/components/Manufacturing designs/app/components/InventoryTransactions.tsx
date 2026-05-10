import { Search, Filter, Download } from 'lucide-react';

const transactions = [
  { date: '2026-05-10 14:23', type: 'GR', docNo: 'GRN-2026-001', material: 'Steel Coil - Grade A', qty: '+500', unit: 'KG', plant: '1000', sloc: 'RAW1', user: 'J.Doe' },
  { date: '2026-05-10 11:45', type: 'GI', docNo: 'MI-2026-0445', material: 'Aluminum Sheet', qty: '-150', unit: 'PCS', plant: '1000', sloc: 'PROD', user: 'M.Smith' },
  { date: '2026-05-10 09:12', type: 'TR', docNo: 'TR-2026-0089', material: 'Copper Wire', qty: '+200', unit: 'M', plant: '2000', sloc: 'RAW2', user: 'S.Johnson' },
  { date: '2026-05-09 16:38', type: 'GR', docNo: 'GRN-2026-000', material: 'Hydraulic Oil', qty: '+120', unit: 'L', plant: '1000', sloc: 'CHEM', user: 'J.Doe' },
  { date: '2026-05-09 14:22', type: 'GI', docNo: 'MI-2026-0444', material: 'Steel Frame Assembly', qty: '-50', unit: 'PCS', plant: '1000', sloc: 'FG01', user: 'R.Williams' },
  { date: '2026-05-09 10:15', type: 'ADJ', docNo: 'ADJ-2026-0012', material: 'Bearing Assembly', qty: '-5', unit: 'PCS', plant: '1000', sloc: 'PROD', user: 'Admin' },
  { date: '2026-05-08 15:47', type: 'GR', docNo: 'GRN-2025-999', material: 'Control Panel PCB', qty: '+300', unit: 'PCS', plant: '1000', sloc: 'ELEC', user: 'J.Doe' },
  { date: '2026-05-08 13:29', type: 'TR', docNo: 'TR-2026-0088', material: 'Gearbox Casing', qty: '+75', unit: 'PCS', plant: '1000', sloc: 'PROD', user: 'M.Smith' },
];

export function InventoryTransactions() {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-300 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-3 py-1.5 min-w-[300px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              className="flex-1 text-[12px] outline-none bg-transparent"
            />
          </div>
          <button className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-[12px] text-gray-700 rounded flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          <select className="px-3 py-1.5 bg-white border border-gray-300 text-[12px] text-gray-700 rounded">
            <option>All Types</option>
            <option>Goods Receipt (GR)</option>
            <option>Goods Issue (GI)</option>
            <option>Transfer (TR)</option>
            <option>Adjustment (ADJ)</option>
          </select>
          <input type="date" className="px-3 py-1.5 bg-white border border-gray-300 text-[12px] text-gray-700 rounded" />
          <span className="text-[12px] text-gray-500">to</span>
          <input type="date" className="px-3 py-1.5 bg-white border border-gray-300 text-[12px] text-gray-700 rounded" />
        </div>
        <button className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-[12px] text-gray-700 rounded flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Date/Time</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Type</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Document No.</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Material</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Quantity</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Unit</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Plant</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Storage Loc</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">User</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr
                key={index}
                className={`border-b border-gray-200 hover:bg-blue-50 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-4 py-2.5 text-gray-600">{tx.date}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                      tx.type === 'GR' ? 'bg-green-100 text-green-700' :
                      tx.type === 'GI' ? 'bg-red-100 text-red-700' :
                      tx.type === 'TR' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[#3498db] hover:underline cursor-pointer">{tx.docNo}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-800">{tx.material}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={tx.qty.startsWith('+') ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                    {tx.qty}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{tx.unit}</td>
                <td className="px-4 py-2.5 text-gray-600">{tx.plant}</td>
                <td className="px-4 py-2.5 text-gray-600">{tx.sloc}</td>
                <td className="px-4 py-2.5 text-gray-600">{tx.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 flex items-center justify-between text-[11px] text-gray-600">
        <div>Showing 1 to {transactions.length} of {transactions.length} transactions</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded">Previous</button>
          <button className="px-3 py-1 bg-[#3498db] text-white border border-[#3498db] rounded">1</button>
          <button className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded">Next</button>
        </div>
      </div>
    </div>
  );
}
