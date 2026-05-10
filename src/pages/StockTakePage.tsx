import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Plus, Settings, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import StockTakeDetailPage from './StockTakeDetailPage';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StockTake {
  id: string;
  take_number: string;
  status: 'OPEN' | 'FROZEN' | 'CLOSED';
  started_by: string;
  started_at: string;
  frozen_at?: string;
  closed_at?: string;
  title?: string;
  person_name?: string;
  notes?: string;
  blind_mode: boolean;
  started_by_profile?: {
    full_name: string;
  };
  total_lines?: number;
  counted_lines?: number;
  total_variance?: number;
}

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  sage_code: string;
  current_stock: number;
}

export default function StockTakePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // If ID is present, show detail page
  if (id) {
    return <StockTakeDetailPage />;
  }
  
  const [loading, setLoading] = useState(true);
  const [activeStockTake, setActiveStockTake] = useState<StockTake | null>(null);
  const [stockTakeHistory, setStockTakeHistory] = useState<StockTake[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTakeTitle, setNewTakeTitle] = useState('');
  const [newTakePersonName, setNewTakePersonName] = useState('');
  const [newTakeNotes, setNewTakeNotes] = useState('');
  const [blindMode, setBlindMode] = useState(false);
  const [mandatoryItems, setMandatoryItems] = useState<string[]>([]);
  const [allRawMaterials, setAllRawMaterials] = useState<RawMaterial[]>([]);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active stock take (OPEN or FROZEN)
      const { data: active } = await supabase
        .from('stock_takes')
        .select(`
          *,
          started_by_profile:started_by(full_name)
        `)
        .in('status', ['OPEN', 'FROZEN'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        // Get progress stats
        const { data: lines } = await supabase
          .from('stock_take_lines')
          .select('id, counted_qty, variance')
          .eq('stock_take_id', active.id);

        const countedLines = lines?.filter(l => l.counted_qty !== null).length || 0;
        const totalVariance = lines?.reduce((sum, l) => sum + (l.variance || 0), 0) || 0;

        setActiveStockTake({
          ...active,
          total_lines: lines?.length || 0,
          counted_lines: countedLines,
          total_variance: totalVariance
        });
      } else {
        setActiveStockTake(null);
      }

      // Fetch history (CLOSED only)
      const { data: history } = await supabase
        .from('stock_takes')
        .select(`
          *,
          started_by_profile:started_by(full_name)
        `)
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(20);

      if (history) {
        // Get stats for each
        const historyWithStats = await Promise.all(
          history.map(async (take) => {
            const { data: lines } = await supabase
              .from('stock_take_lines')
              .select('id, counted_qty, variance')
              .eq('stock_take_id', take.id);

            const countedLines = lines?.filter(l => l.counted_qty !== null).length || 0;
            const totalVariance = lines?.reduce((sum, l) => sum + Math.abs(l.variance || 0), 0) || 0;

            return {
              ...take,
              total_lines: lines?.length || 0,
              counted_lines: countedLines,
              total_variance: totalVariance
            };
          })
        );
        setStockTakeHistory(historyWithStats);
      }

      // Fetch all raw materials for mandatory selection
      const { data: rms } = await supabase
        .from('raw_materials')
        .select('id, code, name, sage_code, current_stock')
        .eq('is_active', true)
        .order('name');

      if (rms) {
        setAllRawMaterials(rms);
        // Pre-select mandatory items
        const defaultMandatory = rms
          .filter(rm => 
            rm.sage_code === 'MAY0001' || // Maize Yellow
            rm.sage_code === 'FFS0001' || // Full Fat Soya
            rm.sage_code === 'SOS0001' || // Soya Solvent
            rm.sage_code === 'MAB0001'    // Maize Bran
          )
          .map(rm => rm.id);
        setMandatoryItems(defaultMandatory);
      }
    } catch (error) {
      console.error('Error fetching stock takes:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTakeNumber = async () => {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('stock_takes')
      .select('take_number')
      .like('take_number', `ST-${year}-%`)
      .order('take_number', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (existing && existing.length > 0) {
      const lastNum = parseInt(existing[0].take_number.split('-')[2]);
      nextNum = lastNum + 1;
    }

    return `ST-${year}-${String(nextNum).padStart(3, '0')}`;
  };

  const handleStartNewStockTake = async () => {
    if (!profile) return;
    setCreating(true);

    try {
      const takeNumber = await generateTakeNumber();

      // Create stock take header
      const { data: stockTake, error: takeError } = await supabase
        .from('stock_takes')
        .insert({
          take_number: takeNumber,
          status: 'OPEN',
          started_by: profile.id,
          title: newTakeTitle || null,
          person_name: newTakePersonName || null,
          notes: newTakeNotes || null,
          blind_mode: blindMode
        })
        .select()
        .single();

      if (takeError) throw takeError;

      // Snapshot all active raw materials
      const lines = allRawMaterials.map(rm => ({
        stock_take_id: stockTake.id,
        raw_material_id: rm.id,
        system_qty: rm.current_stock || 0,
        unit: 'kg',
        is_mandatory: mandatoryItems.includes(rm.id)
      }));

      const { error: linesError } = await supabase
        .from('stock_take_lines')
        .insert(lines);

      if (linesError) throw linesError;

      // Navigate to detail view
      navigate(`/stock-take/${stockTake.id}`);
    } catch (error: any) {
      console.error('Error creating stock take:', error);
      alert(`Failed to create stock take: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'OPEN': 'in_progress',
      'FROZEN': 'pending',
      'CLOSED': 'completed'
    };
    return <StatusBadge status={statusMap[status] || status.toLowerCase()} className={status === 'FROZEN' ? 'animate-pulse' : ''} />;
  };

  const getProgressPercent = (counted: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((counted / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading stock takes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ClipboardList className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Take</h1>
            <p className="text-sm text-gray-500">Physical count and variance management</p>
          </div>
        </div>
      </div>

      {/* Active Stock Take Banner */}
      {activeStockTake ? (
        <div className={`rounded-lg p-6 ${
          activeStockTake.status === 'FROZEN' 
            ? 'bg-amber-50 border-2 border-amber-300' 
            : 'bg-blue-50 border-2 border-blue-300'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{activeStockTake.take_number}</h3>
                {getStatusBadge(activeStockTake.status)}
                {activeStockTake.status === 'FROZEN' && (
                  <div className="flex items-center text-amber-700 text-sm">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Stock movements should pause
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Started by {activeStockTake.started_by_profile?.full_name} on {format(new Date(activeStockTake.started_at), 'PPp')}</p>
                {activeStockTake.notes && <p className="italic">"{activeStockTake.notes}"</p>}
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Progress: {activeStockTake.counted_lines} of {activeStockTake.total_lines} counted</span>
                  <span>{getProgressPercent(activeStockTake.counted_lines || 0, activeStockTake.total_lines || 0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercent(activeStockTake.counted_lines || 0, activeStockTake.total_lines || 0)}%` }}
                  />
                </div>
              </div>

              {/* Variance Summary */}
              {activeStockTake.total_variance !== undefined && (
                <div className="mt-3 text-sm">
                  <span className="text-gray-600">Total Variance: </span>
                  <span className={`font-semibold ${
                    activeStockTake.total_variance === 0 ? 'text-green-600' :
                    activeStockTake.total_variance > 0 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {activeStockTake.total_variance > 0 ? '+' : ''}{activeStockTake.total_variance.toFixed(2)} kg
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate(`/stock-take/${activeStockTake.id}`)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>View Details</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-300">
          <div className="text-center">
            <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Stock Take</h3>
            <p className="text-sm text-gray-500 mb-4">Start a new stock take to begin counting</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Start New Stock Take</span>
              <Settings className="h-4 w-4 ml-2 opacity-70" />
            </button>
          </div>
        </div>
      )}

      {/* Stock Take History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Stock Take History</h2>
        </div>
        
        {stockTakeHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No completed stock takes yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Take Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Variance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stockTakeHistory.map((take) => (
                  <tr key={take.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/stock-take/${take.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{take.take_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(take.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(take.started_at), 'PPp')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {take.started_by_profile?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {take.counted_lines} / {take.total_lines} ({getProgressPercent(take.counted_lines || 0, take.total_lines || 0)}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        take.total_variance === 0 ? 'text-green-600' :
                        (take.total_variance || 0) > 0 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {(take.total_variance || 0) > 0 ? '+' : ''}{(take.total_variance || 0).toFixed(2)} kg
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/stock-take/${take.id}`);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Stock Take Modal */}
      {showNewModal && (
        <Modal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          title="Start New Stock Take"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Take Title
              </label>
              <input
                type="text"
                value={newTakeTitle}
                onChange={(e) => setNewTakeTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Month-end Stock Take, Annual Physical Count"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Person Name
              </label>
              <input
                type="text"
                value={newTakePersonName}
                onChange={(e) => setNewTakePersonName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your name or person responsible"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={newTakeNotes}
                onChange={(e) => setNewTakeNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Additional notes or observations"
              />
            </div>

            <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <input
                type="checkbox"
                id="blindMode"
                checked={blindMode}
                onChange={(e) => setBlindMode(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="blindMode" className="flex-1 text-sm">
                <div className="font-medium text-gray-900">Blind Count Mode</div>
                <div className="text-gray-600">Hide system quantities from counters during entry to prevent bias</div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mandatory Items ({mandatoryItems.length} selected)
              </label>
              
              {/* Show selected items */}
              {mandatoryItems.length > 0 && (
                <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="text-xs font-medium text-indigo-700 mb-2">Selected Items:</div>
                  <div className="flex flex-wrap gap-2">
                    {mandatoryItems.map(id => {
                      const rm = allRawMaterials.find(r => r.id === id);
                      return rm ? (
                        <span key={id} className="inline-flex items-center px-2 py-1 bg-white border border-indigo-300 rounded text-xs text-indigo-900">
                          {rm.code}
                          <button
                            onClick={() => setMandatoryItems(mandatoryItems.filter(i => i !== id))}
                            className="ml-1 text-indigo-500 hover:text-indigo-700"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
              />
              <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                {allRawMaterials
                  .filter(rm => 
                    searchTerm === '' || 
                    rm.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    rm.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((rm) => (
                  <label
                    key={rm.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={mandatoryItems.includes(rm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMandatoryItems([...mandatoryItems, rm.id]);
                        } else {
                          setMandatoryItems(mandatoryItems.filter(id => id !== rm.id));
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900">{rm.code} - {rm.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Stock take cannot be closed until all mandatory items are counted
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleStartNewStockTake}
                disabled={creating}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Start Stock Take</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
