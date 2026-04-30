import { useState, useEffect } from 'react';
import { Wrench, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MaintenanceWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('maintenance_work_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setWorkOrders(data);
    setLoading(false);
  };

  const filteredOrders = filterStatus === 'all' 
    ? workOrders 
    : workOrders.filter(wo => wo.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wrench className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-sm text-gray-500">Maintenance work order management</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex space-x-2">
        {['all', 'open', 'in_progress', 'completed'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg ${
              filterStatus === status
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Work Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No work orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planned Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {wo.wo_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{wo.machine || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{wo.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        wo.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        wo.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        wo.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {wo.planned_date ? new Date(wo.planned_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{wo.performed_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
