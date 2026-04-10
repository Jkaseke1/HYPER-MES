import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Package, Eye, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { GoodsReceivedNote, Supplier, RawMaterial } from '../types/database';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import GRNApprovalButtons from '../components/approval/GRNApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import StatCard from '../components/ui/StatCard';

interface GRNItem {
  raw_material_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string;
}

const emptyForm = {
  grn_number: '',
  supplier_id: '',
  warehouse_id: 'raw_materials_warehouse',
  received_date: new Date().toISOString().split('T')[0],
  weigh_bridge_ticket_no: '',
  status: 'pending' as const,
  notes: '',
};

const emptyItem: GRNItem = {
  raw_material_id: '',
  ordered_qty: 0,
  received_qty: 0,
  unit_cost: 0,
  batch_number: '',
  expiry_date: '',
};

export default function GoodsReceivedPage() {
  const { profile } = useAuth();
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<GoodsReceivedNote | null>(null);
  const [viewing, setViewing] = useState<GoodsReceivedNote | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<GRNItem[]>([emptyItem]);
  const [saving, setSaving] = useState(false);

  // Check if user can delete GRNs (admin or warehouse_manager only)
  const canDelete = profile?.role === 'admin' || profile?.role === 'warehouse_manager';

  async function fetchData() {
    setLoading(true);
    const [grnsRes, suppliersRes, materialsRes] = await Promise.all([
      supabase.from('goods_received_notes').select('*, suppliers(name), warehouses(name)').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
    ]);
    setGrns(grnsRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setMaterials(materialsRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openAdd() {
    setForm(emptyForm);
    setItems([emptyItem]);
    generateGRNNumber();
    setModalOpen(true);
  }

  // Auto-generate GRN number
  async function generateGRNNumber() {
    try {
      const { data, error } = await supabase
        .from('goods_received_notes')
        .select('grn_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastGRN = data[0].grn_number;
        const match = lastGRN.match(/GRN-(\d{4})-(\d{3})$/);
        if (match) {
          const year = parseInt(match[1]);
          const sequence = parseInt(match[2]);
          const currentYear = new Date().getFullYear();
          
          if (year === currentYear) {
            nextNumber = sequence + 1;
          } else {
            // New year, reset sequence to 1
            nextNumber = 1;
          }
        }
      }

      const currentYear = new Date().getFullYear();
      const paddedNumber = nextNumber.toString().padStart(3, '0');
      const newGRNNumber = `GRN-${currentYear}-${paddedNumber}`;
      
      setForm(prev => ({ ...prev, grn_number: newGRNNumber }));
    } catch (error) {
      console.error('Error generating GRN number:', error);
      // Fallback to current year + 001
      const currentYear = new Date().getFullYear();
      setForm(prev => ({ ...prev, grn_number: `GRN-${currentYear}-001` }));
    }
  }

  async function openView(grn: GoodsReceivedNote) {
    setViewing(grn);
    const { data } = await supabase
      .from('grn_items')
      .select('*, raw_materials(name, unit)')
      .eq('grn_id', grn.id);
    setViewItems(data || []);
    setViewModalOpen(true);
  }

  function addItem() {
    setItems([...items, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof GRNItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Check for duplicate GRN number first
      const { data: existing } = await supabase
        .from('goods_received_notes')
        .select('id')
        .eq('grn_number', form.grn_number)
        .single();

      if (existing) {
        alert(`GRN number "${form.grn_number}" already exists. Please use a different number.`);
        setSaving(false);
        return;
      }

      // Validate all line items are either completely empty or completely filled
      const validatedItems = items.map((item, index) => {
        const hasAnyData = item.raw_material_id || 
                          item.ordered_qty > 0 || 
                          item.received_qty > 0 || 
                          item.unit_cost > 0 || 
                          item.batch_number;

        if (hasAnyData) {
          // If any field has data, all required fields must be filled
          if (!item.raw_material_id) {
            return { valid: false, index: index + 1, field: 'Material' };
          }
          if (item.ordered_qty <= 0) {
            return { valid: false, index: index + 1, field: 'Ordered Quantity' };
          }
          if (item.received_qty <= 0) {
            return { valid: false, index: index + 1, field: 'Received Quantity' };
          }
          if (item.unit_cost <= 0) {
            return { valid: false, index: index + 1, field: 'Unit Cost' };
          }
          if (!item.batch_number) {
            return { valid: false, index: index + 1, field: 'Batch Number' };
          }
        }
        
        return { valid: true, hasData: hasAnyData };
      });

      const invalidItem = validatedItems.find(v => !v.valid);
      if (invalidItem) {
        alert(`Line Item ${invalidItem.index}: Please fill in ${invalidItem.field}`);
        setSaving(false);
        return;
      }

      // Filter out completely empty line items
      const completeItems = items.filter((item, index) => validatedItems[index].hasData);

      if (completeItems.length === 0) {
        alert('Please add at least one line item with all required fields filled in.');
        setSaving(false);
        return;
      }

      // Calculate total value
      const totalValue = items.reduce((sum, item) => sum + (item.received_qty * item.unit_cost), 0);
      
      // Insert GRN
      const grnData = { ...form, total_value: totalValue };
      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert(grnData)
        .select()
        .single();

      if (grnError) {
        console.error('Error saving GRN:', grnError);
        alert(`Error: ${grnError.message}`);
        setSaving(false);
        return;
      }

      // Insert GRN items (only complete ones)
      const itemsData = completeItems.map(item => ({
        grn_id: grn.id,
        ...item,
        expiry_date: item.expiry_date || null, // Convert empty string to null
        line_total: item.received_qty * item.unit_cost,
      }));

      const { error: itemsError } = await supabase.from('grn_items').insert(itemsData);

      if (itemsError) {
        console.error('Error saving GRN items:', itemsError);
        // If items fail, delete the GRN to prevent partial save
        await supabase.from('goods_received_notes').delete().eq('id', grn.id);
        alert(`Error saving items: ${itemsError.message}. GRN was not created.`);
        setSaving(false);
        return;
      }

      setSaving(false);
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred. Please try again.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    
    // Check deletion protection - only Pending GRNs can be deleted
    if (deleting.status !== 'pending') {
      alert('Cannot delete — this GRN has been processed. Only pending GRNs can be deleted.');
      setDeleteModalOpen(false);
      setDeleting(null);
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.from('goods_received_notes').delete().eq('id', deleting.id);
      
      if (error) {
        console.error('Error deleting GRN:', error);
        alert(`Error deleting GRN: ${error.message}`);
        setSaving(false);
        return;
      }
      
      setSaving(false);
      setDeleteModalOpen(false);
      setDeleting(null);
      fetchData();
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred while deleting the GRN.');
      setSaving(false);
    }
  }

  const filtered = grns.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return g.grn_number.toLowerCase().includes(q) || 
           g.suppliers?.name.toLowerCase().includes(q);
  });

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors';

  const totalGRNs = grns.length;
  const pendingCount = grns.filter(g => g.status === 'pending').length;
  const approvedCount = grns.filter(g => g.status === 'approved').length;
  const totalValue = grns.reduce((sum, g) => sum + (g.total_value || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Goods Received Notes</h1>
          <p className="text-sm text-slate-500 mt-1">Manage incoming raw material receipts</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Create GRN
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total GRNs" value={totalGRNs} icon={Package} color="teal" />
        <StatCard title="Pending Approval" value={pendingCount} icon={Clock} color="amber" />
        <StatCard title="Approved" value={approvedCount} icon={CheckCircle2} color="emerald" />
        <StatCard title="Total Value" value={`$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={DollarSign} color="slate" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by GRN number or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">No GRNs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">GRN Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Supplier</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Warehouse</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Received Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Total Value</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{grn.grn_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{grn.suppliers?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{grn.warehouses?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{format(new Date(grn.received_date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{grn.total_value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                    <td className="px-4 py-3"><StatusBadge status={grn.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openView(grn)} className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button onClick={() => { setDeleting(grn); setDeleteModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">{filtered.length} GRN{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Goods Received Note" size="xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GRN Number</label>
              <input type="text" required value={form.grn_number} onChange={(e) => setForm({ ...form, grn_number: e.target.value })} className={inputClass} placeholder="e.g. GRN-2026-001" />
              <p className="text-xs text-slate-500 mt-1">Auto-generated from last GRN • Editable if needed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Received Date</label>
              <input type="date" required value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier</label>
              <select required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputClass}>
                <option value="">Select Supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Warehouse</label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium">
                Raw Materials Warehouse
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Weigh Bridge Ticket No</label>
              <input required type="text" value={form.weigh_bridge_ticket_no} onChange={(e) => setForm({ ...form, weigh_bridge_ticket_no: e.target.value })} className={inputClass} placeholder="e.g. WBT-2026-001" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Optional notes..." />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
              <button type="button" onClick={addItem} className="text-sm text-teal-600 hover:text-teal-700 font-medium">+ Add Item</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Material</label>
                    <select required value={item.raw_material_id} onChange={(e) => updateItem(index, 'raw_material_id', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                      <option value="">Select</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Ordered Qty</label>
                    <input type="number" required min="0" step="0.01" value={item.ordered_qty || ''} onChange={(e) => updateItem(index, 'ordered_qty', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Received Qty</label>
                    <input type="number" required min="0" step="0.01" value={item.received_qty || ''} onChange={(e) => updateItem(index, 'received_qty', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unit Cost</label>
                    <input type="number" required min="0" step="0.01" value={item.unit_cost || ''} onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed">Remove</button>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Batch Number</label>
                    <input type="text" required value={item.batch_number} onChange={(e) => updateItem(index, 'batch_number', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="e.g. BATCH-001" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date (Optional)</label>
                    <input type="date" value={item.expiry_date} onChange={(e) => updateItem(index, 'expiry_date', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Create GRN'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete GRN" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <Package className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">Are you sure you want to delete GRN <span className="font-semibold">{deleting?.grn_number}</span>? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title="GRN Details" size="lg">
        {viewing && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">GRN Number</p>
                <p className="text-sm font-semibold text-slate-800">{viewing.grn_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Received Date</p>
                <p className="text-sm text-slate-700">{format(new Date(viewing.received_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Supplier</p>
                <p className="text-sm text-slate-700">{viewing.suppliers?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Warehouse</p>
                <p className="text-sm text-slate-700">{viewing.warehouses?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Weigh Bridge Ticket No</p>
                <p className="text-sm font-mono text-slate-700">{(viewing as any).weigh_bridge_ticket_no || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <StatusBadge status={viewing.status} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Approval Progress</p>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`px-2 py-1 rounded ${viewing.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    ✓ Receipt
                  </div>
                  <span className="text-slate-400">→</span>
                  <div className={`px-2 py-1 rounded ${viewing.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : viewing.status === 'rm_approved' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {viewing.status === 'approved' ? '✓ Finance' : 'Finance'}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Value</p>
                <p className="text-sm font-semibold text-slate-800">{viewing.total_value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
              </div>
              {viewing.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{viewing.notes}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Line Items</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Material</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Ordered</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Received</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Unit Cost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Line Total</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Batch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{item.raw_materials?.name || '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.ordered_qty} {item.raw_materials?.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">{item.received_qty} {item.raw_materials?.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.unit_cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-medium">{item.line_total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{item.batch_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {(viewing.status === 'pending' || viewing.status === 'rm_approved') && (
              <div className="border-t border-slate-200 pt-4">
                <GRNApprovalButtons
                  grnId={viewing.id}
                  currentStatus={viewing.status}
                  onApproved={() => {
                    fetchData();
                  }}
                  onRejected={() => {
                    setViewModalOpen(false);
                    fetchData();
                  }}
                />
              </div>
            )}

            {viewing.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{viewing.rejection_reason}</p>
              </div>
            )}

            <div className="border-t border-slate-200 pt-4">
              <ApprovalHistory entityType="grn" entityId={viewing.id} />
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button onClick={() => setViewModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
