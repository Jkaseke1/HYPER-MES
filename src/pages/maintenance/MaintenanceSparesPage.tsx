import { useState, useEffect } from 'react';
import { Wrench, Plus, AlertTriangle, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

interface MaintenanceSpare {
  id: string;
  item_no: number;
  description: string;
  machine: string;
  category: string;
  sub_group: string;
  qty_on_hand: number;
  min_stock: number;
  unit: string;
  notes?: string;
  dimensions_notes?: string;
}

export default function MaintenanceSparesPage() {
  const [spares, setSpares] = useState<MaintenanceSpare[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSubGroup, setFilterSubGroup] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<'description' | 'qty_on_hand' | 'min_stock'>('description');
  const [sortAsc, setSortAsc] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSpare, setNewSpare] = useState({
    description: '',
    machine: '',
    category: 'Bearings',
    sub_group: 'Pelletiser',
    qty_on_hand: 0,
    min_stock: 0,
    unit: 'pcs',
    notes: '',
    dimensions_notes: ''
  });

  const categories = ['all', 'Bearings', 'V-Belts', 'Oil Seals', 'Die Parts', 'Cylinders', 'Drives', 'Chains', 'Electrical', 'Lubricants', 'Filters', 'Rolls & Rods', 'Elevator Belts', 'Misc'];
  const subGroups = ['all', 'Pelletiser', 'Dog Extruder', 'Full Fat Extruder', 'Hammer Mill', 'Elevator', 'Compressor', 'Boiler', 'Red Plant', 'Conveyor', 'Mixer', 'Crumpler', 'Rotary Feeder', 'Pneumatic Cylinders', 'Drives', 'Forklift', 'General', 'Extruder', 'Powder Cleaners', 'Cooler', 'Augers', 'Pneumatics & Valves'];

  useEffect(() => {
    fetchSpares();
  }, []);

  const fetchSpares = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('maintenance_spares')
      .select('*')
      .order('item_no');
    if (data) setSpares(data);
    setLoading(false);
  };

  const handleAddSpare = async () => {
    if (!newSpare.description.trim()) return;
    
    setAdding(true);
    try {
      // Get next item_no
      const maxItemNo = spares.length > 0 ? Math.max(...spares.map(s => s.item_no || 0)) : 0;
      
      const { error } = await supabase
        .from('maintenance_spares')
        .insert({
          item_no: maxItemNo + 1,
          description: newSpare.description,
          machine: newSpare.machine || null,
          category: newSpare.category,
          sub_group: newSpare.sub_group,
          qty_on_hand: Number(newSpare.qty_on_hand),
          min_stock: Number(newSpare.min_stock),
          unit: newSpare.unit,
          notes: newSpare.notes || null,
          dimensions_notes: newSpare.dimensions_notes || null
        });
      
      if (error) throw error;
      
      // Reset form and refresh
      setNewSpare({
        description: '',
        machine: '',
        category: 'Bearings',
        sub_group: 'Pelletiser',
        qty_on_hand: 0,
        min_stock: 0,
        unit: 'pcs',
        notes: '',
        dimensions_notes: ''
      });
      setShowAddModal(false);
      fetchSpares();
    } catch (error) {
      console.error('Error adding spare:', error);
      alert('Failed to add spare. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const getStatus = (spare: MaintenanceSpare) => {
    if (spare.min_stock === 0) return { label: 'No Min Set', color: 'bg-gray-100 text-gray-700' };
    if (spare.qty_on_hand === 0) return { label: 'Critical', color: 'bg-red-100 text-red-700' };
    if (spare.qty_on_hand < spare.min_stock) return { label: 'Low', color: 'bg-amber-100 text-amber-700' };
    return { label: 'OK', color: 'bg-green-100 text-green-700' };
  };

  const filteredSpares = spares
    .filter(s => 
      (filterCategory === 'all' || s.category === filterCategory) &&
      (filterSubGroup === 'all' || s.sub_group === filterSubGroup) &&
      (filterStatus === 'all' || getStatus(s).label.toLowerCase() === filterStatus.toLowerCase()) &&
      (searchTerm === '' || 
        s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.machine.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });

  const stats = {
    total: spares.length,
    critical: spares.filter(s => s.min_stock > 0 && s.qty_on_hand === 0).length,
    low: spares.filter(s => s.qty_on_hand > 0 && s.qty_on_hand < s.min_stock).length,
    ok: spares.filter(s => s.qty_on_hand >= s.min_stock).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wrench className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Spares Inventory</h1>
            <p className="text-sm text-gray-500">Plant maintenance spare parts management</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Spare</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Parts" value={stats.total} icon={Wrench} />
        <StatCard title="Critical (0 Stock)" value={stats.critical} icon={AlertTriangle} color="red" />
        <StatCard title="Low Stock" value={stats.low} icon={AlertTriangle} color="amber" />
        <StatCard title="OK" value={stats.ok} icon={Wrench} color="emerald" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search description or machine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
            ))}
          </select>
          <select
            value={filterSubGroup}
            onChange={(e) => setFilterSubGroup(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {subGroups.map(sg => (
              <option key={sg} value={sg}>{sg === 'all' ? 'All Sub-Groups' : sg}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="critical">Critical</option>
            <option value="low">Low</option>
            <option value="ok">OK</option>
            <option value="no min set">No Min Set</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => { setSortField('description'); setSortAsc(!sortAsc); }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Description</span>
                      {sortField === 'description' && (sortAsc ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Hand</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSpares.map((spare) => (
                  <tr key={spare.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{spare.description}</div>
                      {spare.dimensions_notes && (
                        <div className="text-xs text-gray-500">{spare.dimensions_notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{spare.machine}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{spare.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{spare.qty_on_hand}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{spare.min_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{spare.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatus(spare).color}`}>
                        {getStatus(spare).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button className="text-indigo-600 hover:text-indigo-900">Issue</button>
                      <button className="text-green-600 hover:text-green-900">Receive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Spare Modal */}
      {showAddModal && (
        <Modal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Spare"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={newSpare.description}
                onChange={(e) => setNewSpare({ ...newSpare, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., 32217 bearings"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Machine</label>
              <input
                type="text"
                value={newSpare.machine}
                onChange={(e) => setNewSpare({ ...newSpare, machine: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Palletiser"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newSpare.category}
                  onChange={(e) => setNewSpare({ ...newSpare, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Group</label>
                <select
                  value={newSpare.sub_group}
                  onChange={(e) => setNewSpare({ ...newSpare, sub_group: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {subGroups.filter(sg => sg !== 'all').map(sg => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty On Hand</label>
                <input
                  type="number"
                  value={newSpare.qty_on_hand}
                  onChange={(e) => setNewSpare({ ...newSpare, qty_on_hand: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                <input
                  type="number"
                  value={newSpare.min_stock}
                  onChange={(e) => setNewSpare({ ...newSpare, min_stock: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  value={newSpare.unit}
                  onChange={(e) => setNewSpare({ ...newSpare, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="pcs">pcs</option>
                  <option value="m">m</option>
                  <option value="L">L</option>
                  <option value="kg">kg</option>
                  <option value="sets">sets</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions Notes</label>
              <input
                type="text"
                value={newSpare.dimensions_notes}
                onChange={(e) => setNewSpare({ ...newSpare, dimensions_notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., 160mm shaft, 32mm bore"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={newSpare.notes}
                onChange={(e) => setNewSpare({ ...newSpare, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Additional notes (grease fill %, life expectancy, etc.)"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={adding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSpare}
                disabled={adding}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Spare'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
