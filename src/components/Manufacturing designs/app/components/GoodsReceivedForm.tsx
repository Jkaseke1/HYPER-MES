import { X, Save, Calendar, Plus, Trash2, Link as LinkIcon } from 'lucide-react';

interface GoodsReceivedFormProps {
  show: boolean;
  onClose: () => void;
}

export function GoodsReceivedForm({ show, onClose }: GoodsReceivedFormProps) {
  if (!show) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-[13px] text-gray-600 mb-3">No goods receipt note selected</p>
            <p className="text-[11px] text-gray-500">Click "New GRN" to create a new goods received note</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto bg-white border border-gray-300 rounded-lg shadow-sm">
        {/* Form Header */}
        <div className="bg-gray-50 border-b border-gray-300 px-5 py-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-800">Create Goods Received Note</h2>
          <button onClick={onClose} className="hover:bg-gray-200 p-1 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {/* Header Section */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">GRN Number *</label>
              <input
                type="text"
                value="GRN-2026-001"
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-[12px] text-gray-600"
              />
              <p className="text-[10px] text-gray-500 mt-1">Auto-generated from last GRN • Editable if needed</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Received Date *</label>
              <div className="relative">
                <input
                  type="text"
                  value="09/05/2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[12px] text-gray-800"
                />
                <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Supplier *</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded text-[12px] text-gray-800">
                <option>Select Supplier</option>
                <option>Acme Steel Supplies Ltd</option>
                <option>Industrial Parts Co.</option>
                <option>Premium Materials Inc.</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Warehouse *</label>
              <input
                type="text"
                value="Raw Materials Warehouse"
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-[12px] text-gray-600"
              />
            </div>
          </div>

          {/* Link Weigh Bridge Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <LinkIcon className="w-4 h-4 text-[#3498db] mt-0.5" />
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Link Weigh Bridge Ticket <span className="font-normal text-gray-500">(optional — pick an existing ticket or fill in manually below)</span>
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-[12px] text-gray-800 bg-white">
                  <option>— Select a Weigh Bridge Ticket —</option>
                  <option>WBT-2026-0234 (Pending)</option>
                  <option>WBT-2026-0233 (Completed)</option>
                </select>
                <p className="text-[10px] text-gray-600 mt-2">No open WB tickets. Go to Weigh Bridge to create one first.</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Notes</label>
            <textarea
              placeholder="Optional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-[12px] text-gray-800 resize-none"
            ></textarea>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-[11px] font-semibold text-gray-700">Line Items</label>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#3498db] hover:bg-blue-50 rounded">
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
            <div className="border border-gray-300 rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Material</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Ordered Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Received Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Unit Cost</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Batch Number</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Expiry Date (Optional)</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      <select className="w-full px-2 py-1 border border-gray-300 rounded text-[11px]">
                        <option>Select</option>
                        <option>Steel Coil - Grade A</option>
                        <option>Aluminum Sheet</option>
                        <option>Copper Wire</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="text" className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-[11px]" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input type="text" className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-[11px]" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-[11px] text-gray-500 italic">Pending</div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" placeholder="e.g. BATCH-001" className="w-28 px-2 py-1 border border-gray-300 rounded text-[11px]" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" placeholder="dd/mm/yyyy" className="w-28 px-2 py-1 border border-gray-300 rounded text-[11px]" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button className="hover:bg-gray-200 p-1 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Form Footer */}
        <div className="bg-gray-50 border-t border-gray-300 px-5 py-3 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-[12px] text-gray-700 rounded"
          >
            Cancel
          </button>
          <button className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-[12px] text-gray-700 rounded">
            Save as Draft
          </button>
          <button className="px-4 py-2 bg-[#3498db] hover:bg-[#2980b9] text-white text-[12px] rounded flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Post GRN
          </button>
        </div>
      </div>
    </div>
  );
}
